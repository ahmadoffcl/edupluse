import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(500),
});
const deleteSchema = z.object({
  studentId: z.string().uuid(),
});

export async function POST(
  request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await contextParams.params;
  const access = await requireClassAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const body = schema.parse(await request.json());
  const { data: memberships, error: membershipError } = await context.supabase
    .from("memberships")
    .select("profile_id")
    .eq("org_id", context.session.orgId)
    .eq("role", "student")
    .eq("status", "active")
    .in("profile_id", body.studentIds);

  if (membershipError) {
    return NextResponse.json(
      { ok: false, error: "Unable to verify students." },
      { status: 500 },
    );
  }

  const validStudentIds = new Set(
    (memberships ?? []).map((membership) => membership.profile_id as string),
  );
  const enrollments = body.studentIds
    .filter((studentId) => validStudentIds.has(studentId))
    .map((studentId) => ({
      org_id: context.session.orgId,
      class_id: id,
      student_id: studentId,
    }));

  if (enrollments.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid students were selected." },
      { status: 400 },
    );
  }

  const { error } = await context.supabase
    .from("enrollments")
    .upsert(enrollments, {
      onConflict: "class_id,student_id",
      ignoreDuplicates: true,
    });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to add students." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.class.students_added",
    entity: "enrollments",
    entityId: id,
    metadata: { count: enrollments.length },
  });

  return NextResponse.json({ ok: true, added: enrollments.length });
}

export async function DELETE(
  request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await contextParams.params;
  const access = await requireClassAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const body = deleteSchema.parse(await request.json());
  const { error } = await context.supabase
    .from("enrollments")
    .delete()
    .eq("org_id", context.session.orgId)
    .eq("class_id", id)
    .eq("student_id", body.studentId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to remove student." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.class.student_removed",
    entity: "enrollments",
    entityId: id,
    metadata: { studentId: body.studentId },
  });

  return NextResponse.json({ ok: true });
}
