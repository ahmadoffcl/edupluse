import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

type DbRecord = Record<string, unknown>;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const context = await requireWorkflowContext(["student"]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  const { assignmentId } = await params;
  const { data: assignment, error: assignmentError } = await context.supabase
    .from("assignments")
    .select("id,title,class_id,teacher_id")
    .eq("id", assignmentId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (assignmentError || !assignment) {
    return NextResponse.json(
      { ok: false, error: "Assignment was not found." },
      { status: 404 },
    );
  }

  const { data: enrollment, error: enrollmentError } = await context.supabase
    .from("enrollments")
    .select("id")
    .eq("org_id", context.session.orgId)
    .eq("class_id", assignment.class_id)
    .eq("student_id", context.profileId)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    return NextResponse.json(
      { ok: false, error: "You are not enrolled in this class." },
      { status: 403 },
    );
  }

  const { data: submission, error: submissionError } = await context.supabase
    .from("submissions")
    .select("id,status,file_path")
    .eq("org_id", context.session.orgId)
    .eq("assignment_id", assignmentId)
    .eq("student_id", context.profileId)
    .maybeSingle();

  if (submissionError || !submission) {
    return NextResponse.json({ ok: true, removed: false });
  }

  const row = submission as DbRecord;
  const status = stringValue(row.status);
  if (status === "graded" || status === "returned") {
    return NextResponse.json(
      { ok: false, error: "Returned work cannot be unsubmitted." },
      { status: 409 },
    );
  }

  const { error: deleteError } = await context.supabase
    .from("submissions")
    .delete()
    .eq("id", stringValue(row.id))
    .eq("org_id", context.session.orgId)
    .eq("student_id", context.profileId);

  if (deleteError) {
    return NextResponse.json(
      { ok: false, error: "Unable to unsubmit this assignment." },
      { status: 500 },
    );
  }

  const filePath = stringValue(row.file_path);
  if (filePath) {
    await context.supabase.storage.from("submissions").remove([filePath]);
  }

  if (assignment.teacher_id) {
    const { error: notificationError } = await context.supabase
      .from("notifications")
      .insert({
        org_id: context.session.orgId,
        recipient_id: assignment.teacher_id,
        title: "Submission unsubmitted",
        body: `${context.session.displayName} unsubmitted ${assignment.title}.`,
        kind: "submission",
      });

    if (notificationError) {
      console.warn("Unsubmit notification skipped", notificationError.code);
    }
  }

  await writeAuditLog(context, {
    action: "student.assignment.unsubmitted",
    entity: "submissions",
    entityId: stringValue(row.id),
    metadata: { assignmentId, filePath },
  });

  return NextResponse.json({ ok: true, removed: true });
}
