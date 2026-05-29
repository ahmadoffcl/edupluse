import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { isAdminRole } from "@/lib/server/workflow-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  isMissingLearningMissionEventsTable,
  isMissingLearningMissionsTable,
} from "@/lib/dashboard/learning-missions";

type DbRecord = Record<string, unknown>;

export type MissionEngagementSummary = {
  total: number;
  open: number;
  completed: number;
  dismissed: number;
  urgent: number;
  activeStudents: number;
  classesWithBlockers: number;
  events: number;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function getMissionEngagementSummary(): Promise<MissionEngagementSummary> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();
  const empty = {
    total: 0,
    open: 0,
    completed: 0,
    dismissed: 0,
    urgent: 0,
    activeStudents: 0,
    classesWithBlockers: 0,
    events: 0,
  };

  if (!session || !isAdminRole(session.role) || !supabase) return empty;

  const [missionsResult, eventsResult] = await Promise.all([
    supabase
      .from("learning_missions")
      .select("status,priority,profile_id,class_id")
      .eq("org_id", session.orgId)
      .limit(5000),
    supabase
      .from("learning_mission_events")
      .select("id")
      .eq("org_id", session.orgId)
      .limit(5000),
  ]);

  if (missionsResult.error) {
    if (!isMissingLearningMissionsTable(missionsResult.error)) {
      console.warn("Mission analytics unavailable", missionsResult.error.code);
    }
    return empty;
  }

  const rows = (missionsResult.data ?? []) as DbRecord[];
  const openRows = rows.filter((row) => stringValue(row.status) === "open");
  const eventRows =
    eventsResult.error &&
    isMissingLearningMissionEventsTable(eventsResult.error)
      ? []
      : ((eventsResult.data ?? []) as DbRecord[]);
  return {
    total: rows.length,
    open: openRows.length,
    completed: rows.filter((row) => stringValue(row.status) === "completed")
      .length,
    dismissed: rows.filter((row) => stringValue(row.status) === "dismissed")
      .length,
    urgent: openRows.filter((row) => stringValue(row.priority) === "urgent")
      .length,
    activeStudents: new Set(rows.map((row) => stringValue(row.profile_id)))
      .size,
    classesWithBlockers: new Set(
      openRows
        .filter((row) => stringValue(row.priority) === "urgent")
        .map((row) => stringValue(row.class_id))
        .filter(Boolean),
    ).size,
    events: eventRows.length,
  };
}
