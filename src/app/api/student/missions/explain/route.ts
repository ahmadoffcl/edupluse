import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fallbackMissionExplanation,
  getStudentDailyFocus,
  isMissingLearningMissionEventsTable,
  isMissingLearningMissionsTable,
  isMissingMissionColumn,
} from "@/lib/dashboard/learning-missions";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  sourceKey: z.string().min(3).max(240),
});

export async function POST(request: Request) {
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
      { ok: false, error: "Mission explanation request is invalid." },
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

  if (mission.aiExplanation) {
    return NextResponse.json({
      ok: true,
      text: mission.aiExplanation,
      cached: true,
      demo: false,
    });
  }

  let text = fallbackMissionExplanation(mission);
  let demo = true;

  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await generateText({
        model: openai(process.env.OPENAI_MODEL ?? "gpt-4.1-mini"),
        system:
          "You are EduPulse Smart Learning. Give short, practical coaching for one real student mission. Do not invent assignments, grades, teachers, or facts. Use only the provided mission context.",
        prompt: [
          `Mission: ${mission.title}`,
          `Class: ${mission.className ?? "General"}`,
          `Reason: ${mission.reason}`,
          `Evidence: ${mission.evidence}`,
          `Deadline: ${mission.timeLabel ?? mission.dueAt ?? "No deadline"}`,
          `Status: ${mission.status}`,
          "Return exactly three short sections: Why this matters, 20-minute plan, What to do after.",
        ].join("\n"),
      });
      text = result.text.trim() || text;
      demo = false;
    } catch (error) {
      console.warn(
        "Mission AI explanation fallback",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await context.supabase
    .from("learning_missions")
    .upsert(
      {
        org_id: context.session.orgId,
        profile_id: context.profileId,
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
        status: mission.status,
        due_at: mission.dueAt,
        completed_at: mission.completedAt,
        snoozed_until: mission.snoozedUntil,
        started_at: mission.startedAt,
        last_seen_at: now,
        ai_explanation: text,
        ai_explained_at: now,
        metadata: {
          ...mission.metadata,
          actionHref: mission.actionHref,
          className: mission.className,
          evidence: mission.evidence,
          lane: mission.lane,
          timeLabel: mission.timeLabel,
        },
        updated_at: now,
      },
      { onConflict: "org_id,profile_id,source_key" },
    )
    .select("id")
    .maybeSingle();

  if (
    error &&
    !isMissingMissionColumn(error, "ai_explanation") &&
    !isMissingLearningMissionsTable(error)
  ) {
    console.warn("Mission explanation cache skipped", error.code);
  }

  const eventError = await context.supabase
    .from("learning_mission_events")
    .insert({
      org_id: context.session.orgId,
      profile_id: context.profileId,
      class_id: mission.classId,
      assignment_id: mission.assignmentId,
      mission_id: (data?.id as string | undefined) ?? mission.id,
      source_key: mission.sourceKey,
      event_type: "ai_explained",
      title: "AI study steps opened",
      body: mission.title,
      metadata: {
        actionHref: mission.actionHref,
        className: mission.className,
        sourceLabel: mission.sourceLabel,
      },
    });

  if (
    eventError.error &&
    !isMissingLearningMissionEventsTable(eventError.error)
  ) {
    console.warn("Mission AI event skipped", eventError.error.code);
  }

  await context.supabase.from("ai_interactions").insert({
    org_id: context.session.orgId,
    firebase_uid: context.session.uid,
    role: context.session.role,
    kind: "mission_coach",
    prompt: mission.title,
    response: text,
  });

  await writeAuditLog(context, {
    action: "student.mission.ai_explained",
    entity: "learning_missions",
    entityId: (data?.id as string | undefined) ?? mission.id,
    metadata: { sourceKey: mission.sourceKey, demo },
  });

  return NextResponse.json({ ok: true, text, cached: false, demo });
}
