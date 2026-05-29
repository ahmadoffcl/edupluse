import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type DbRecord = Record<string, unknown>;
type SupabaseServiceClient = NonNullable<
  ReturnType<typeof getSupabaseServiceClient>
>;

export type LearningMissionStatus = "open" | "completed" | "dismissed";
export type LearningMissionPriority = "low" | "normal" | "high" | "urgent";
export type LearningMissionLane =
  | "due_soon"
  | "needs_attention"
  | "new_from_teacher"
  | "feedback"
  | "practice";
export type LearningMissionKind =
  | "assignment_due"
  | "missing_submission"
  | "new_resource"
  | "teacher_feedback"
  | "study_streak"
  | "weak_topic";
export type LearningMissionAction =
  | "start"
  | "complete"
  | "dismiss"
  | "snooze"
  | "open_source"
  | "reopen";

export type LearningMission = {
  id: string | null;
  sourceKey: string;
  kind: LearningMissionKind;
  lane: LearningMissionLane;
  title: string;
  description: string;
  reason: string;
  evidence: string;
  sourceLabel: string;
  priority: LearningMissionPriority;
  status: LearningMissionStatus;
  dueAt: string | null;
  timeLabel: string | null;
  completedAt: string | null;
  snoozedUntil: string | null;
  startedAt: string | null;
  lastSeenAt: string | null;
  classId: string | null;
  className: string | null;
  assignmentId: string | null;
  actionHref: string;
  sourceHref: string;
  aiExplanation: string | null;
  aiExplainedAt: string | null;
  metadata: Record<string, unknown>;
};

export type LearningMissionTimelineItem = {
  id: string;
  title: string;
  body: string;
  kind: string;
  createdAt: string;
  actionHref: string | null;
  className: string | null;
};

export type LearningMissionProgress = {
  total: number;
  open: number;
  completed: number;
  dismissed: number;
  urgent: number;
  snoozed: number;
  clear: boolean;
};

export type LearningMissionFocusData = {
  missions: LearningMission[];
  visibleMissions: LearningMission[];
  focusMission: LearningMission | null;
  groupedMissions: Record<LearningMissionLane, LearningMission[]>;
  timeline: LearningMissionTimelineItem[];
  progress: LearningMissionProgress;
};

export const missionLaneLabels: Record<LearningMissionLane, string> = {
  due_soon: "Due Soon",
  needs_attention: "Needs Attention",
  new_from_teacher: "New From Teacher",
  feedback: "Feedback",
  practice: "Practice",
};

function relation(row: DbRecord, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

function asRows(value: unknown): DbRecord[] {
  return Array.isArray(value) ? (value as DbRecord[]) : [];
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isMissingLearningMissionsTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(candidate.message?.includes("learning_missions"))
  );
}

export function isMissingLearningMissionEventsTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(candidate.message?.includes("learning_mission_events"))
  );
}

export function isMissingMissionColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    Boolean(
      candidate.message?.includes(column) &&
      (candidate.message.includes("schema cache") ||
        candidate.message.includes("does not exist")),
    )
  );
}

function priorityRank(priority: LearningMissionPriority) {
  if (priority === "urgent") return 0;
  if (priority === "high") return 1;
  if (priority === "normal") return 2;
  return 3;
}

function laneForKind(kind: LearningMissionKind): LearningMissionLane {
  if (kind === "assignment_due") return "due_soon";
  if (kind === "missing_submission") return "needs_attention";
  if (kind === "new_resource") return "new_from_teacher";
  if (kind === "teacher_feedback") return "feedback";
  return "practice";
}

function sourceLabelForKind(kind: LearningMissionKind) {
  if (kind === "assignment_due" || kind === "missing_submission") {
    return "Assignment";
  }
  if (kind === "new_resource") return "Material";
  if (kind === "teacher_feedback") return "Feedback";
  return "Practice";
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function hasTodayActivity(rows: DbRecord[]) {
  const today = new Date().toISOString().slice(0, 10);
  return rows.some((row) => stringValue(row.created_at).slice(0, 10) === today);
}

function timeLabel(value: string | null) {
  if (!value) return null;
  const dueTime = new Date(value).getTime();
  if (!Number.isFinite(dueTime)) return null;

  const delta = dueTime - Date.now();
  const abs = Math.abs(delta);
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (delta < 0) {
    if (abs < hour) return "Overdue just now";
    if (abs < day) return `Overdue ${Math.ceil(abs / hour)}h`;
    return `Overdue ${Math.ceil(abs / day)}d`;
  }

  if (delta < hour) return `Due in ${Math.max(1, Math.ceil(delta / 60000))}m`;
  if (delta < day) return `Due in ${Math.ceil(delta / hour)}h`;
  if (delta < 2 * day) return "Due tomorrow";
  return `Due in ${Math.ceil(delta / day)}d`;
}

function deterministicExplanation(mission: LearningMission) {
  const steps =
    mission.kind === "new_resource"
      ? "Open the material, skim headings first, then write three points you understood."
      : mission.kind === "teacher_feedback"
        ? "Read the feedback, compare it with your submitted work, then fix one issue."
        : mission.kind === "weak_topic"
          ? "Reopen the class material, practice the weak topic, then ask your teacher one focused question."
          : mission.kind === "study_streak"
            ? "Open any class and finish one small learning action to keep momentum."
            : "Open the assignment, finish the smallest clear part first, then upload your work.";

  return [
    `Priority: ${mission.reason}`,
    `Why now: ${mission.evidence}`,
    `20 minute plan: ${steps}`,
  ].join("\n\n");
}

export function fallbackMissionExplanation(mission: LearningMission) {
  return deterministicExplanation(mission);
}

function missionWithPersistedStatus(
  mission: Omit<
    LearningMission,
    | "id"
    | "status"
    | "completedAt"
    | "snoozedUntil"
    | "startedAt"
    | "lastSeenAt"
    | "aiExplanation"
    | "aiExplainedAt"
  >,
  persisted: Map<string, DbRecord>,
): LearningMission {
  const saved = persisted.get(mission.sourceKey);
  const status = stringValue(saved?.status, "open") as LearningMissionStatus;
  const metadata = recordValue(saved?.metadata);

  return {
    ...mission,
    id: stringValue(saved?.id) || null,
    status: ["open", "completed", "dismissed"].includes(status)
      ? status
      : "open",
    completedAt: stringValue(saved?.completed_at) || null,
    snoozedUntil: stringValue(saved?.snoozed_until) || null,
    startedAt: stringValue(saved?.started_at) || null,
    lastSeenAt: stringValue(saved?.last_seen_at) || null,
    aiExplanation: stringValue(saved?.ai_explanation) || null,
    aiExplainedAt: stringValue(saved?.ai_explained_at) || null,
    metadata: { ...mission.metadata, ...metadata },
  };
}

async function currentProfileId(supabase: SupabaseServiceClient, uid: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("firebase_uid", uid)
    .maybeSingle();

  if (error) throw error;
  return typeof data?.id === "string" ? data.id : null;
}

async function persistedMissionRows(
  supabase: SupabaseServiceClient,
  orgId: string,
  profileId: string,
) {
  const enhanced = await supabase
    .from("learning_missions")
    .select(
      "id,source_key,status,completed_at,snoozed_until,started_at,last_seen_at,ai_explanation,ai_explained_at,metadata,created_at",
    )
    .eq("org_id", orgId)
    .eq("profile_id", profileId)
    .limit(500);

  if (!enhanced.error) return (enhanced.data ?? []) as DbRecord[];
  if (isMissingLearningMissionsTable(enhanced.error)) return [];
  if (!isMissingMissionColumn(enhanced.error, "snoozed_until")) {
    return [];
  }

  const fallback = await supabase
    .from("learning_missions")
    .select("id,source_key,status,completed_at")
    .eq("org_id", orgId)
    .eq("profile_id", profileId)
    .limit(500);

  if (fallback.error) return [];
  return (fallback.data ?? []) as DbRecord[];
}

async function missionEventRows(
  supabase: SupabaseServiceClient,
  orgId: string,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("learning_mission_events")
    .select("id,source_key,event_type,title,body,created_at,class_id,metadata")
    .eq("org_id", orgId)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    if (!isMissingLearningMissionEventsTable(error)) {
      console.warn("Mission events unavailable", error.code);
    }
    return [];
  }

  return (data ?? []) as DbRecord[];
}

function emptyFocusData(): LearningMissionFocusData {
  return {
    missions: [],
    visibleMissions: [],
    focusMission: null,
    groupedMissions: {
      due_soon: [],
      needs_attention: [],
      new_from_teacher: [],
      feedback: [],
      practice: [],
    },
    timeline: [],
    progress: {
      total: 0,
      open: 0,
      completed: 0,
      dismissed: 0,
      urgent: 0,
      snoozed: 0,
      clear: true,
    },
  };
}

function buildTimeline(
  missions: LearningMission[],
  eventRows: DbRecord[],
): LearningMissionTimelineItem[] {
  const eventItems = eventRows.map((row) => {
    const metadata = recordValue(row.metadata);
    return {
      id: stringValue(row.id) || `${stringValue(row.source_key)}-event`,
      title: stringValue(row.title, "Mission activity"),
      body: stringValue(row.body) || stringValue(row.event_type),
      kind: stringValue(row.event_type, "mission"),
      createdAt: stringValue(row.created_at) || new Date().toISOString(),
      actionHref: stringValue(metadata.actionHref) || null,
      className: stringValue(metadata.className) || null,
    };
  });

  const missionItems = missions
    .filter((mission) =>
      [
        "assignment_due",
        "missing_submission",
        "new_resource",
        "teacher_feedback",
      ].includes(mission.kind),
    )
    .slice(0, 8)
    .map((mission) => ({
      id: `${mission.sourceKey}-signal`,
      title:
        mission.kind === "new_resource"
          ? "New material is ready"
          : mission.kind === "teacher_feedback"
            ? "Teacher feedback returned"
            : mission.kind === "missing_submission"
              ? "Work needs attention"
              : "Deadline is coming up",
      body: mission.title,
      kind: mission.kind,
      createdAt:
        stringValue(mission.metadata.createdAt) ||
        mission.dueAt ||
        new Date().toISOString(),
      actionHref: mission.actionHref,
      className: mission.className,
    }));

  return [...eventItems, ...missionItems]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 10);
}

function sortMissions(a: LearningMission, b: LearningMission) {
  const statusRank = (mission: LearningMission) =>
    mission.status === "open" ? 0 : mission.status === "completed" ? 2 : 3;
  const statusDelta = statusRank(a) - statusRank(b);
  if (statusDelta) return statusDelta;

  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta) return priorityDelta;

  const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  return aTime - bTime;
}

export async function getStudentDailyFocus(): Promise<LearningMissionFocusData> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || session.role !== "student" || !supabase) {
    return emptyFocusData();
  }

  const profileId = await currentProfileId(supabase, session.uid).catch(
    () => null,
  );
  if (!profileId) return emptyFocusData();

  const enrollmentsResult = await supabase
    .from("enrollments")
    .select("class_id,classes(name)")
    .eq("org_id", session.orgId)
    .eq("student_id", profileId)
    .limit(200);

  if (enrollmentsResult.error) return emptyFocusData();

  const enrollmentRows = (enrollmentsResult.data ?? []) as DbRecord[];
  const classIds = enrollmentRows
    .map((row) => stringValue(row.class_id))
    .filter(Boolean);
  if (classIds.length === 0) return emptyFocusData();

  const classNameById = new Map(
    enrollmentRows.map((row) => [
      stringValue(row.class_id),
      stringValue(relation(row, "classes")?.name, "Classroom"),
    ]),
  );

  const [
    assignmentsResult,
    resourcesResult,
    xpResult,
    persistedRows,
    eventRows,
  ] = await Promise.all([
    supabase
      .from("assignments")
      .select(
        "id,title,due_at,status,points,class_id,created_at,published_at,classes(name),subjects(name),submissions(id,status,score,feedback,graded_at,submitted_at,student_id)",
      )
      .eq("org_id", session.orgId)
      .in("class_id", classIds)
      .neq("status", "draft")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(120),
    supabase
      .from("resources")
      .select("id,title,type,created_at,class_id,classes(name)")
      .eq("org_id", session.orgId)
      .in("class_id", classIds)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("gamification_events")
      .select("id,xp,created_at")
      .eq("org_id", session.orgId)
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(30),
    persistedMissionRows(supabase, session.orgId, profileId),
    missionEventRows(supabase, session.orgId, profileId),
  ]);

  const persisted = new Map(
    persistedRows.map((row) => [stringValue(row.source_key), row]),
  );
  const missions: LearningMission[] = [];
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  for (const assignment of (assignmentsResult.data ?? []) as DbRecord[]) {
    const assignmentId = stringValue(assignment.id);
    const classId = stringValue(assignment.class_id) || null;
    const className =
      stringValue(relation(assignment, "classes")?.name) ||
      (classId ? classNameById.get(classId) : null) ||
      "Classroom";
    const title = stringValue(assignment.title, "Assignment");
    const subject = stringValue(relation(assignment, "subjects")?.name);
    const dueAt = stringValue(assignment.due_at) || null;
    const dueTime = dueAt ? new Date(dueAt).getTime() : null;
    const submissions = asRows(assignment.submissions).filter(
      (submission) => stringValue(submission.student_id) === profileId,
    );
    const ownSubmission = submissions[0];
    const actionHref = `/student/assignments/${assignmentId}`;
    const assignmentMetadata = {
      points: numberValue(assignment.points),
      subject,
      createdAt:
        stringValue(assignment.published_at) ||
        stringValue(assignment.created_at),
    };

    if (!ownSubmission && dueAt && dueTime !== null && dueTime < now) {
      missions.push(
        missionWithPersistedStatus(
          {
            sourceKey: `assignment-missing:${assignmentId}`,
            kind: "missing_submission",
            lane: laneForKind("missing_submission"),
            title: `Submit missing work: ${title}`,
            description: `${className}${subject ? ` - ${subject}` : ""} is past deadline.`,
            reason: "Deadline has passed and no submission is recorded.",
            evidence: "You have not submitted this assignment yet.",
            sourceLabel: sourceLabelForKind("missing_submission"),
            priority: "urgent",
            dueAt,
            timeLabel: timeLabel(dueAt),
            classId,
            className,
            assignmentId,
            actionHref,
            sourceHref: actionHref,
            metadata: assignmentMetadata,
          },
          persisted,
        ),
      );
      continue;
    }

    if (
      !ownSubmission &&
      dueAt &&
      dueTime !== null &&
      dueTime >= now &&
      dueTime <= now + sevenDays
    ) {
      const hoursLeft = Math.max(1, Math.ceil((dueTime - now) / 3_600_000));
      missions.push(
        missionWithPersistedStatus(
          {
            sourceKey: `assignment-due:${assignmentId}`,
            kind: "assignment_due",
            lane: laneForKind("assignment_due"),
            title: `Finish ${title}`,
            description: `${className}${subject ? ` - ${subject}` : ""} has a deadline coming up.`,
            reason: "Deadline is approaching and no submission is recorded.",
            evidence: `${timeLabel(dueAt) ?? `${hoursLeft}h left`} before the deadline.`,
            sourceLabel: sourceLabelForKind("assignment_due"),
            priority: hoursLeft <= 24 ? "high" : "normal",
            dueAt,
            timeLabel: timeLabel(dueAt),
            classId,
            className,
            assignmentId,
            actionHref,
            sourceHref: actionHref,
            metadata: { ...assignmentMetadata, hoursLeft },
          },
          persisted,
        ),
      );
    }

    if (ownSubmission?.feedback || ownSubmission?.graded_at) {
      const score =
        typeof ownSubmission.score === "number"
          ? numberValue(ownSubmission.score)
          : null;
      missions.push(
        missionWithPersistedStatus(
          {
            sourceKey: `feedback:${stringValue(ownSubmission.id, assignmentId)}`,
            kind: "teacher_feedback",
            lane: laneForKind("teacher_feedback"),
            title: `Review feedback: ${title}`,
            description:
              stringValue(ownSubmission.feedback) ||
              "Your teacher returned this work.",
            reason: "Teacher returned feedback on your submitted work.",
            evidence:
              score === null
                ? "Returned by teacher."
                : `Returned score ${score}%.`,
            sourceLabel: sourceLabelForKind("teacher_feedback"),
            priority: "normal",
            dueAt: stringValue(ownSubmission.graded_at) || null,
            timeLabel: stringValue(ownSubmission.graded_at) ? "Returned" : null,
            classId,
            className,
            assignmentId,
            actionHref,
            sourceHref: actionHref,
            metadata: {
              ...assignmentMetadata,
              score,
              createdAt: stringValue(ownSubmission.graded_at),
            },
          },
          persisted,
        ),
      );
    }

    if (typeof ownSubmission?.score === "number" && ownSubmission.score < 60) {
      missions.push(
        missionWithPersistedStatus(
          {
            sourceKey: `weak-topic:${assignmentId}`,
            kind: "weak_topic",
            lane: laneForKind("weak_topic"),
            title: `Strengthen ${subject || title}`,
            description: `Your returned score was ${numberValue(ownSubmission.score)}%.`,
            reason: "This score shows a weak area worth practicing now.",
            evidence: `Score is below 60% in ${className}.`,
            sourceLabel: sourceLabelForKind("weak_topic"),
            priority: "high",
            dueAt: null,
            timeLabel: null,
            classId,
            className,
            assignmentId,
            actionHref,
            sourceHref: classId
              ? `/student/classes/${classId}?tab=materials`
              : actionHref,
            metadata: {
              ...assignmentMetadata,
              score: numberValue(ownSubmission.score),
            },
          },
          persisted,
        ),
      );
    }
  }

  for (const resource of ((resourcesResult.data ?? []) as DbRecord[]).slice(
    0,
    8,
  )) {
    const createdAt = new Date(stringValue(resource.created_at)).getTime();
    if (!Number.isFinite(createdAt) || createdAt < fourteenDaysAgo) continue;
    const resourceId = stringValue(resource.id);
    const classId = stringValue(resource.class_id) || null;
    const className =
      stringValue(relation(resource, "classes")?.name) ||
      (classId ? classNameById.get(classId) : null) ||
      "Classroom";
    const sourceHref = classId
      ? `/student/classes/${classId}?tab=materials`
      : "/student/notes";

    missions.push(
      missionWithPersistedStatus(
        {
          sourceKey: `resource:${resourceId}`,
          kind: "new_resource",
          lane: laneForKind("new_resource"),
          title: `Open new material: ${stringValue(resource.title, "Resource")}`,
          description: `${className} has a new ${stringValue(resource.type, "resource").replace("_", " ")} ready to review.`,
          reason: "Your teacher uploaded new learning material.",
          evidence: `New ${stringValue(resource.type, "resource").replace("_", " ")} added to ${className}.`,
          sourceLabel: sourceLabelForKind("new_resource"),
          priority: "low",
          dueAt: null,
          timeLabel: "New",
          classId,
          className,
          assignmentId: null,
          actionHref: sourceHref,
          sourceHref,
          metadata: {
            resourceId,
            createdAt: stringValue(resource.created_at),
          },
        },
        persisted,
      ),
    );
  }

  if (!hasTodayActivity((xpResult.data ?? []) as DbRecord[])) {
    missions.push(
      missionWithPersistedStatus(
        {
          sourceKey: `study-streak:${profileId}:${new Date().toISOString().slice(0, 10)}`,
          kind: "study_streak",
          lane: laneForKind("study_streak"),
          title: "Keep your learning streak alive",
          description:
            "Open one class, review one note, or submit one task before today ends.",
          reason: "No learning activity has been recorded today.",
          evidence: "One small action is enough to keep momentum.",
          sourceLabel: sourceLabelForKind("study_streak"),
          priority: "normal",
          dueAt: endOfToday(),
          timeLabel: "Today",
          classId: null,
          className: null,
          assignmentId: null,
          actionHref: "/student/classes",
          sourceHref: "/student/classes",
          metadata: {},
        },
        persisted,
      ),
    );
  }

  const sortedMissions = missions.sort(sortMissions).slice(0, 20);
  const visibleMissions = sortedMissions.filter((mission) => {
    if (mission.status === "dismissed") return false;
    if (!mission.snoozedUntil) return true;
    return new Date(mission.snoozedUntil).getTime() <= Date.now();
  });
  const openMissions = visibleMissions.filter(
    (mission) => mission.status === "open",
  );
  const groupedMissions = {
    due_soon: visibleMissions.filter((mission) => mission.lane === "due_soon"),
    needs_attention: visibleMissions.filter(
      (mission) => mission.lane === "needs_attention",
    ),
    new_from_teacher: visibleMissions.filter(
      (mission) => mission.lane === "new_from_teacher",
    ),
    feedback: visibleMissions.filter((mission) => mission.lane === "feedback"),
    practice: visibleMissions.filter((mission) => mission.lane === "practice"),
  } satisfies Record<LearningMissionLane, LearningMission[]>;
  const snoozed = sortedMissions.filter(
    (mission) =>
      mission.snoozedUntil &&
      new Date(mission.snoozedUntil).getTime() > Date.now(),
  ).length;

  return {
    missions: sortedMissions,
    visibleMissions,
    focusMission: openMissions[0] ?? null,
    groupedMissions,
    timeline: buildTimeline(visibleMissions, eventRows),
    progress: {
      total: sortedMissions.length,
      open: openMissions.length,
      completed: sortedMissions.filter(
        (mission) => mission.status === "completed",
      ).length,
      dismissed: sortedMissions.filter(
        (mission) => mission.status === "dismissed",
      ).length,
      urgent: openMissions.filter((mission) => mission.priority === "urgent")
        .length,
      snoozed,
      clear: openMissions.length === 0,
    },
  };
}

export async function getStudentLearningMissions(): Promise<LearningMission[]> {
  const focus = await getStudentDailyFocus();
  return focus.missions;
}
