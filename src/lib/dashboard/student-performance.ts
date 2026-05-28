import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import {
  engagementHeavyPerformance,
  performanceBand,
} from "@/lib/server/performance";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type DbRecord = Record<string, unknown>;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

export type StudentPerformanceData = {
  profileId: string | null;
  attendancePercent: number;
  submittedPercent: number;
  averageScore: number;
  xp: number;
  missingCount: number;
  lateCount: number;
  performanceScore: number;
  band: string;
  feedback: Array<{
    title: string;
    score: number | null;
    feedback: string | null;
    gradedAt: string | null;
  }>;
};

export async function getStudentPerformanceData(): Promise<StudentPerformanceData> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  const empty = {
    profileId: null,
    attendancePercent: 0,
    submittedPercent: 0,
    averageScore: 0,
    xp: 0,
    missingCount: 0,
    lateCount: 0,
    performanceScore: 0,
    band: "no_data",
    feedback: [],
  };

  if (!session || !supabase) return empty;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("firebase_uid", session.uid)
    .maybeSingle();
  const profileId = stringValue((profile as DbRecord | null)?.id);
  if (!profileId) return empty;

  const [
    enrollmentsResult,
    assignmentsResult,
    submissionsResult,
    attendanceResult,
    xpResult,
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select("class_id")
      .eq("org_id", session.orgId)
      .eq("student_id", profileId),
    supabase
      .from("assignments")
      .select("id,class_id")
      .eq("org_id", session.orgId),
    supabase
      .from("submissions")
      .select(
        "id,assignment_id,status,score,feedback,graded_at,assignments(title)",
      )
      .eq("org_id", session.orgId)
      .eq("student_id", profileId),
    supabase
      .from("attendance_records")
      .select("status")
      .eq("org_id", session.orgId)
      .eq("student_id", profileId),
    supabase
      .from("gamification_events")
      .select("xp")
      .eq("org_id", session.orgId)
      .eq("profile_id", profileId),
  ]);

  const classIds = new Set(
    ((enrollmentsResult.data ?? []) as DbRecord[])
      .map((row) => stringValue(row.class_id))
      .filter(Boolean),
  );
  const assignments = ((assignmentsResult.data ?? []) as DbRecord[]).filter(
    (row) => classIds.has(stringValue(row.class_id)),
  );
  const submissions = (submissionsResult.data ?? []) as DbRecord[];
  const attendance = (attendanceResult.data ?? []) as DbRecord[];
  const xp = ((xpResult.data ?? []) as DbRecord[]).reduce(
    (total, row) => total + numberValue(row.xp),
    0,
  );
  const presentCount = attendance.filter(
    (row) => row.status === "present" || row.status === "late",
  ).length;
  const gradedScores = submissions
    .map((row) => numberValue(row.score, NaN))
    .filter((score) => Number.isFinite(score));
  const averageScore = gradedScores.length
    ? Math.round(
        gradedScores.reduce((total, score) => total + score, 0) /
          gradedScores.length,
      )
    : 0;
  const lateCount = submissions.filter((row) => row.status === "late").length;
  const missingCount = Math.max(0, assignments.length - submissions.length);
  const submittedPercent = percent(submissions.length, assignments.length);
  const attendancePercent = percent(presentCount, attendance.length);
  const performanceScore = engagementHeavyPerformance({
    attendancePercent,
    submittedPercent,
    averageScore,
    xp,
    missingCount,
    lateCount,
    recentActivityCount: submissions.length + (xpResult.data?.length ?? 0),
  });

  return {
    profileId,
    attendancePercent,
    submittedPercent,
    averageScore,
    xp,
    missingCount,
    lateCount,
    performanceScore,
    band: performanceBand(performanceScore),
    feedback: submissions
      .filter((row) => row.feedback || row.score)
      .map((row) => {
        const assignment = row.assignments as DbRecord | DbRecord[] | undefined;
        const resolvedAssignment = Array.isArray(assignment)
          ? assignment[0]
          : assignment;
        return {
          title: stringValue(resolvedAssignment?.title, "Assignment"),
          score: typeof row.score === "number" ? numberValue(row.score) : null,
          feedback: stringValue(row.feedback) || null,
          gradedAt: stringValue(row.graded_at) || null,
        };
      }),
  };
}
