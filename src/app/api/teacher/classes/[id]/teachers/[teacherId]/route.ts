import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEduPulseEmail } from "@/lib/email/server";
import {
  isAdminRole,
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
});

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isMissingRelation(error: unknown, relation: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(candidate.message?.includes(relation))
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; teacherId: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  const { id, teacherId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Choose approve or reject." },
      { status: 400 },
    );
  }

  const { data: classRecord, error: classError } = await context.supabase
    .from("classes")
    .select("id,name,teacher_id")
    .eq("org_id", context.session.orgId)
    .eq("id", id)
    .maybeSingle();

  if (classError || !classRecord) {
    return NextResponse.json(
      { ok: false, error: "Class was not found." },
      { status: 404 },
    );
  }

  const isPrimaryTeacher = stringValue(classRecord.teacher_id) === context.profileId;
  if (!isAdminRole(context.session.role) && !isPrimaryTeacher) {
    return NextResponse.json(
      { ok: false, error: "Only the class owner can review co-teachers." },
      { status: 403 },
    );
  }

  const { data: teacherRow, error: teacherError } = await context.supabase
    .from("class_teachers")
    .select("id,teacher_id,status")
    .eq("org_id", context.session.orgId)
    .eq("class_id", id)
    .eq("teacher_id", teacherId)
    .is("removed_at", null)
    .maybeSingle();

  if (teacherError) {
    if (isMissingRelation(teacherError, "class_teachers")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Co-teacher approvals are being prepared. Try again after the workspace update.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unable to load this co-teacher." },
      { status: 500 },
    );
  }

  if (!teacherRow) {
    return NextResponse.json(
      { ok: false, error: "Co-teacher request was not found." },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();
  const approved = parsed.data.action === "approve";
  const { error: updateError } = await context.supabase
    .from("class_teachers")
    .update(
      approved
        ? {
            status: "active",
            approved_at: now,
            approved_by: context.profileId,
            rejected_at: null,
            updated_at: now,
          }
        : {
            status: "rejected",
            rejected_at: now,
            approved_at: null,
            approved_by: null,
            updated_at: now,
          },
    )
    .eq("org_id", context.session.orgId)
    .eq("class_id", id)
    .eq("teacher_id", teacherId);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: "Unable to update this co-teacher." },
      { status: 500 },
    );
  }

  const { data: teacherProfile } = await context.supabase
    .from("profiles")
    .select("display_name,email")
    .eq("id", teacherId)
    .maybeSingle();
  const teacherName = stringValue(teacherProfile?.display_name, "Teacher");
  const teacherEmail = stringValue(teacherProfile?.email);
  const title = approved ? "Co-teacher approved" : "Co-teacher request declined";
  const body = approved
    ? `You can now collaborate in ${classRecord.name}.`
    : `${classRecord.name} is not available for your teacher account right now.`;

  await context.supabase.from("notifications").insert({
    org_id: context.session.orgId,
    recipient_id: teacherId,
    title,
    body,
    kind: "teacher_invite",
    action_url: approved ? `/teacher/classes/${id}` : "/teacher",
    metadata: { classId: id, status: approved ? "active" : "rejected" },
  });

  if (teacherEmail) {
    await sendEduPulseEmail({
      to: teacherEmail,
      subject: approved
        ? `You can now teach ${classRecord.name}`
        : `Update about ${classRecord.name}`,
      eyebrow: "Class collaboration",
      title,
      body,
      detailLabel: "Class",
      detailValue: classRecord.name,
      actionLabel: approved ? "Open class" : "Open EduPulse",
      actionUrl: `${new URL(request.url).origin}${approved ? `/teacher/classes/${id}` : "/teacher"}`,
    });
  }

  await writeAuditLog(context, {
    action: approved ? "teacher.coteacher.approved" : "teacher.coteacher.rejected",
    entity: "class_teachers",
    entityId: stringValue(teacherRow.id),
    metadata: { classId: id, teacherId, teacherName },
  });

  return NextResponse.json({
    ok: true,
    status: approved ? "active" : "rejected",
  });
}
