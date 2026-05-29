import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import {
  safeStorageName,
  validateTeacherUpload,
} from "@/lib/server/upload-validation";

export const runtime = "nodejs";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const context = await requireWorkflowContext(["student"]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  const profileId = context.profileId;

  const formData = await request.formData();
  const assignmentId = textValue(formData, "assignmentId");
  const content = textValue(formData, "content") || null;
  const file = formData.get("file");

  if (!assignmentId) {
    return NextResponse.json(
      { ok: false, error: "Assignment is required." },
      { status: 400 },
    );
  }

  if (!content && !(file instanceof File && file.size > 0)) {
    return NextResponse.json(
      { ok: false, error: "Add a file or a note before submitting." },
      { status: 400 },
    );
  }

  const { data: assignment, error: assignmentError } = await context.supabase
    .from("assignments")
    .select("id,title,class_id,due_at,teacher_id")
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
    .eq("student_id", profileId)
    .maybeSingle();

  if (enrollmentError || !enrollment) {
    return NextResponse.json(
      { ok: false, error: "You are not enrolled in this class." },
      { status: 403 },
    );
  }

  const { data: existing } = await context.supabase
    .from("submissions")
    .select("status,file_path")
    .eq("org_id", context.session.orgId)
    .eq("assignment_id", assignmentId)
    .eq("student_id", profileId)
    .maybeSingle();

  if (existing?.status === "graded") {
    return NextResponse.json(
      { ok: false, error: "This submission has already been graded." },
      { status: 409 },
    );
  }

  let filePath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const validation = validateTeacherUpload(file);
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 },
      );
    }

    const safeName = safeStorageName(file.name);
    filePath = `${context.session.orgId}/submissions/${profileId}/${assignmentId}/${randomUUID()}-${safeName}`;
    const { error: uploadError } = await context.supabase.storage
      .from("submissions")
      .upload(filePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: "Unable to upload submission file." },
        { status: 500 },
      );
    }
  }

  const dueAt = assignment.due_at ? new Date(assignment.due_at) : null;
  const status = dueAt && dueAt.getTime() < Date.now() ? "late" : "submitted";
  const submittedAt = new Date().toISOString();
  const fileMetadata =
    file instanceof File && file.size > 0
      ? {
          file_size: file.size,
          mime_type: file.type,
          original_filename: safeStorageName(file.name),
        }
      : {};
  const { data, error } = await context.supabase
    .from("submissions")
    .upsert(
      {
        org_id: context.session.orgId,
        assignment_id: assignmentId,
        student_id: profileId,
        status,
        content,
        file_path: filePath ?? existing?.file_path ?? null,
        ...fileMetadata,
        submitted_at: submittedAt,
      },
      { onConflict: "assignment_id,student_id" },
    )
    .select("id,status,submitted_at")
    .single();

  if (error) {
    if (filePath) {
      await context.supabase.storage.from("submissions").remove([filePath]);
    }

    return NextResponse.json(
      { ok: false, error: "Unable to submit assignment." },
      { status: 500 },
    );
  }

  if (filePath && existing?.file_path && existing.file_path !== filePath) {
    await context.supabase.storage
      .from("submissions")
      .remove([existing.file_path]);
  }

  if (assignment.teacher_id) {
    const { error: notificationError } = await context.supabase
      .from("notifications")
      .insert({
        org_id: context.session.orgId,
        recipient_id: assignment.teacher_id,
        title: "Assignment submitted",
        body: `${context.session.displayName} submitted ${assignment.title}.`,
        kind: "submission",
      });

    if (notificationError) {
      console.warn("Submission notification skipped", notificationError.code);
    }
  }

  await writeAuditLog(context, {
    action: "student.assignment.submitted",
    entity: "submissions",
    entityId: data.id,
    metadata: { assignmentId, filePath, status },
  });

  return NextResponse.json({ ok: true, submission: data });
}
