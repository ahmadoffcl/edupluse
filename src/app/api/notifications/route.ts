import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireWorkflowContext,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

type DbRecord = Record<string, unknown>;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function recordValue(value: unknown): DbRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DbRecord)
    : {};
}

function isMissingNotificationColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    Boolean(
      candidate.message?.includes("schema cache") ||
      candidate.message?.includes("does not exist"),
    )
  );
}

export async function GET() {
  const context = await requireWorkflowContext(
    ["student", "teacher", "admin", "super_admin"],
    { profileRequired: false },
  );
  if (isWorkflowResponse(context)) return context;

  if (!context.profileId) {
    return NextResponse.json({ ok: true, notifications: [] });
  }

  const enhancedResult = await context.supabase
    .from("notifications")
    .select(
      "id,title,body,kind,read_at,created_at,scheduled_for,metadata,action_url",
    )
    .eq("org_id", context.session.orgId)
    .eq("recipient_id", context.profileId)
    .order("created_at", { ascending: false })
    .limit(50);
  let rowsData = (enhancedResult.data ?? []) as DbRecord[];
  let queryError: unknown = enhancedResult.error;

  if (
    enhancedResult.error &&
    isMissingNotificationColumn(enhancedResult.error)
  ) {
    const fallbackResult = await context.supabase
      .from("notifications")
      .select("id,title,body,kind,read_at,created_at")
      .eq("org_id", context.session.orgId)
      .eq("recipient_id", context.profileId)
      .order("created_at", { ascending: false })
      .limit(12);
    rowsData = (fallbackResult.data ?? []) as DbRecord[];
    queryError = fallbackResult.error;
  }

  if (queryError) {
    return NextResponse.json({ ok: true, notifications: [] });
  }

  const now = Date.now();
  const rows = rowsData.filter((row) => {
    const scheduledFor = stringValue(row.scheduled_for);
    if (!scheduledFor) return true;
    const scheduledDate = new Date(scheduledFor);
    return (
      !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() <= now
    );
  });
  const assignmentReminderIds = rows
    .filter((row) => stringValue(row.kind) === "assignment_reminder")
    .map((row) => stringValue(recordValue(row.metadata).assignmentId))
    .filter(Boolean);
  const submittedAssignmentIds = new Set<string>();

  if (assignmentReminderIds.length > 0) {
    const { data: submissions } = await context.supabase
      .from("submissions")
      .select("assignment_id")
      .eq("org_id", context.session.orgId)
      .eq("student_id", context.profileId)
      .in("assignment_id", assignmentReminderIds);

    for (const submission of (submissions ?? []) as DbRecord[]) {
      submittedAssignmentIds.add(stringValue(submission.assignment_id));
    }
  }

  const notifications = rows
    .filter((row) => {
      if (stringValue(row.kind) !== "assignment_reminder") return true;
      const assignmentId = stringValue(recordValue(row.metadata).assignmentId);
      return !assignmentId || !submittedAssignmentIds.has(assignmentId);
    })
    .slice(0, 12)
    .map((row) => ({
      id: stringValue(row.id),
      title: stringValue(row.title, "Notification"),
      body: stringValue(row.body),
      kind: stringValue(row.kind, "info"),
      readAt: stringValue(row.read_at) || null,
      createdAt: stringValue(row.created_at) || new Date().toISOString(),
      actionUrl: stringValue(row.action_url) || null,
    }));

  return NextResponse.json({ ok: true, notifications });
}
