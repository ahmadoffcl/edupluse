import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getStudentDailyFocus,
  isMissingLearningMissionEventsTable,
  isMissingLearningMissionsTable,
  isMissingMissionColumn,
  type LearningMission,
  type LearningMissionAction,
  type LearningMissionStatus,
} from "@/lib/dashboard/learning-missions";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  sourceKey: z.string().min(3).max(240),
  action: z
    .enum(["start", "complete", "dismiss", "snooze", "open_source", "reopen"])
    .optional(),
  status: z.enum(["open", "completed", "dismissed"]).optional(),
  snoozedUntil: z.string().datetime().optional(),
});

function actionFromBody(body: z.infer<typeof schema>): LearningMissionAction {
  if (body.action) return body.action;
  if (body.status === "completed") return "complete";
  if (body.status === "dismissed") return "dismiss";
  return "reopen";
}

function statusForAction(
  action: LearningMissionAction,
  current: LearningMissionStatus,
): LearningMissionStatus {
  if (action === "complete") return "completed";
  if (action === "dismiss") return "dismissed";
  if (action === "reopen") return "open";
  return current === "dismissed" ? "open" : current;
}

function eventCopy(action: LearningMissionAction, mission: LearningMission) {
  if (action === "complete") {
    return {
      eventType: "completed",
      title: "Mission completed",
      body: mission.title,
    };
  }
  if (action === "dismiss") {
    return {
      eventType: "dismissed",
      title: "Mission dismissed",
      body: mission.title,
    };
  }
  if (action === "snooze") {
    return {
      eventType: "snoozed",
      title: "Mission snoozed",
      body: mission.title,
    };
  }
  if (action === "open_source") {
    return {
      eventType: "opened_source",
      title: "Mission source opened",
      body: mission.title,
    };
  }
  return {
    eventType: "started",
    title: "Mission started",
    body: mission.title,
  };
}

function defaultSnoozeUntil() {
  const date = new Date();
  date.setHours(date.getHours() + 4);
  return date.toISOString();
}

function missionPayload(
  mission: LearningMission,
  action: LearningMissionAction,
  status: LearningMissionStatus,
  snoozedUntil: string | null,
) {
  const now = new Date().toISOString();

  return {
    class_id: mission.classId,
    assignment_id: mission.assignmentId,
    source_key: mission.sourceKey,
    kind: mission.kind,
    title: mission.title,
    description: mission.description,
    reason: mission.reason,
    source_label: mission.sourceLabel,
    source_href: mission.sourceHref,
    priority: mission.priority,
    status,
    due_at: mission.dueAt,
    completed_at:
      action === "complete"
        ? now
        : status === "completed"
          ? mission.completedAt
          : null,
    snoozed_until: action === "snooze" ? snoozedUntil : null,
    started_at:
      action === "start" || action === "open_source"
        ? (mission.startedAt ?? now)
        : mission.startedAt,
    last_seen_at: now,
    metadata: {
      ...mission.metadata,
      actionHref: mission.actionHref,
      className: mission.className,
      evidence: mission.evidence,
      lane: mission.lane,
      timeLabel: mission.timeLabel,
    },
    updated_at: now,
  };
}

async function logMissionEvent({
  context,
  mission,
  action,
  missionId,
  snoozedUntil,
}: {
  context: Awaited<ReturnType<typeof requireWorkflowContext>>;
  mission: LearningMission;
  action: LearningMissionAction;
  missionId: string | null;
  snoozedUntil: string | null;
}) {
  if (isWorkflowResponse(context)) return;
  const copy = eventCopy(action, mission);
  const { error } = await context.supabase
    .from("learning_mission_events")
    .insert({
      org_id: context.session.orgId,
      profile_id: context.profileId,
      class_id: mission.classId,
      assignment_id: mission.assignmentId,
      mission_id: missionId,
      source_key: mission.sourceKey,
      event_type: copy.eventType,
      title: copy.title,
      body: copy.body,
      metadata: {
        actionHref: mission.actionHref,
        className: mission.className,
        sourceLabel: mission.sourceLabel,
        snoozedUntil,
      },
    });

  if (error && !isMissingLearningMissionEventsTable(error)) {
    console.warn("Mission event skipped", error.code);
  }
}

export async function GET() {
  const context = await requireWorkflowContext(["student"]);
  if (isWorkflowResponse(context)) return context;

  return NextResponse.json({
    ok: true,
    data: await getStudentDailyFocus(),
  });
}

export async function PATCH(request: Request) {
  const context = await requireWorkflowContext(["student"]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { ok: false, error: "Mission update is invalid." },
      { status: 400 },
    );
  }

  const focus = await getStudentDailyFocus();
  const mission = focus.missions.find(
    (item) => item.sourceKey === body.data.sourceKey,
  );

  if (!mission) {
    return NextResponse.json(
      { ok: false, error: "Mission was not found." },
      { status: 404 },
    );
  }

  const action = actionFromBody(body.data);
  const status = statusForAction(action, mission.status);
  const snoozedUntil =
    action === "snooze"
      ? (body.data.snoozedUntil ?? defaultSnoozeUntil())
      : null;

  const payload = {
    org_id: context.session.orgId,
    profile_id: context.profileId,
    ...missionPayload(mission, action, status, snoozedUntil),
  };
  const { data, error } = await context.supabase
    .from("learning_missions")
    .upsert(payload, { onConflict: "org_id,profile_id,source_key" })
    .select("id")
    .maybeSingle();

  if (error) {
    if (
      isMissingMissionColumn(error, "reason") ||
      isMissingLearningMissionsTable(error)
    ) {
      const fallback = await context.supabase.from("learning_missions").upsert(
        {
          org_id: context.session.orgId,
          profile_id: context.profileId,
          class_id: mission.classId,
          assignment_id: mission.assignmentId,
          source_key: mission.sourceKey,
          kind: mission.kind,
          title: mission.title,
          description: mission.description,
          priority: mission.priority,
          status,
          due_at: mission.dueAt,
          completed_at: action === "complete" ? new Date().toISOString() : null,
          metadata: {
            ...mission.metadata,
            actionHref: mission.actionHref,
            className: mission.className,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,profile_id,source_key" },
      );

      if (fallback.error) {
        return NextResponse.json(
          { ok: false, error: "Unable to update mission." },
          { status: 500 },
        );
      }
    } else {
      return NextResponse.json(
        { ok: false, error: "Unable to update mission." },
        { status: 500 },
      );
    }
  }

  await logMissionEvent({
    context,
    mission,
    action,
    missionId: (data?.id as string | undefined) ?? mission.id,
    snoozedUntil,
  });

  await writeAuditLog(context, {
    action: "student.mission.updated",
    entity: "learning_missions",
    entityId: (data?.id as string | undefined) ?? mission.id,
    metadata: {
      sourceKey: mission.sourceKey,
      action,
      status,
      kind: mission.kind,
    },
  });

  return NextResponse.json({ ok: true, data: await getStudentDailyFocus() });
}
