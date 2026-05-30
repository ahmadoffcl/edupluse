import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

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

function isMissingColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    Boolean(candidate.message?.includes(column))
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const context = await requireWorkflowContext(["teacher"]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Teacher profile is not ready." },
      { status: 404 },
    );
  }

  const classAccess = await requireClassAccess(context, id);
  if (isWorkflowResponse(classAccess)) return classAccess;

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

  const isPrimaryTeacher =
    stringValue(classRecord.teacher_id) === context.profileId;

  let classTeachersHaveStatus = true;
  let coTeachers: unknown[] | null = null;
  let coTeacherError: unknown = null;
  const activeCoTeacherResult = await context.supabase
    .from("class_teachers")
    .select("id,teacher_id,status")
    .eq("org_id", context.session.orgId)
    .eq("class_id", id)
    .eq("status", "active")
    .is("removed_at", null)
    .limit(20);

  if (
    activeCoTeacherResult.error &&
    isMissingColumn(activeCoTeacherResult.error, "status")
  ) {
    classTeachersHaveStatus = false;
    const fallbackCoTeacherResult = await context.supabase
      .from("class_teachers")
      .select("id,teacher_id")
      .eq("org_id", context.session.orgId)
      .eq("class_id", id)
      .is("removed_at", null)
      .limit(20);
    coTeachers = fallbackCoTeacherResult.data;
    coTeacherError = fallbackCoTeacherResult.error;
  } else {
    coTeachers = activeCoTeacherResult.data;
    coTeacherError = activeCoTeacherResult.error;
  }

  if (coTeacherError && !isMissingRelation(coTeacherError, "class_teachers")) {
    return NextResponse.json(
      { ok: false, error: "Unable to update class teachers." },
      { status: 500 },
    );
  }

  const activeCoTeachers = ((coTeachers ?? []) as Array<{
    id: string;
    teacher_id: string;
  }>).filter((teacher) => teacher.teacher_id !== context.profileId);

  if (isPrimaryTeacher) {
    const replacement = activeCoTeachers[0]?.teacher_id ?? null;
    if (!replacement) {
      return NextResponse.json(
        {
          ok: false,
          error: "Add another approved teacher before leaving this class.",
        },
        { status: 400 },
      );
    }

    const { error: updateError } = await context.supabase
      .from("classes")
      .update({
        teacher_id: replacement,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", context.session.orgId)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: "Unable to remove you from this class." },
        { status: 500 },
      );
    }

    await context.supabase
      .from("class_teachers")
      .update({
        role: "owner",
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", context.session.orgId)
      .eq("class_id", id)
      .eq("teacher_id", replacement);
  }

  if (!coTeacherError) {
    const selfUpdate: Record<string, string> = {
      removed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (classTeachersHaveStatus) selfUpdate.status = "rejected";

    await context.supabase
      .from("class_teachers")
      .update(selfUpdate)
      .eq("org_id", context.session.orgId)
      .eq("class_id", id)
      .eq("teacher_id", context.profileId);
  }

  await writeAuditLog(context, {
    action: "teacher.class.left",
    entity: "classes",
    entityId: id,
    metadata: {
      wasPrimaryTeacher: isPrimaryTeacher,
      className: classRecord.name,
    },
  });

  return NextResponse.json({ ok: true });
}
