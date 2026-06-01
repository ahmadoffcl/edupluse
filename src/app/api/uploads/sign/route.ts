import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminRole,
  isTeacherRole,
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
} from "@/lib/server/workflow-auth";
import {
  safeStorageName,
  validateClassBannerUpload,
  validateTeacherUpload,
} from "@/lib/server/upload-validation";
import type { UploadedFileMetadata } from "@/lib/uploads/types";

export const runtime = "nodejs";

const schema = z.object({
  purpose: z.enum([
    "class_banner",
    "teacher_resource",
    "assignment_attachment",
    "student_submission",
    "student_note",
  ]),
  fileName: z.string().trim().min(1).max(220),
  mimeType: z.string().trim().min(1).max(180),
  fileSize: z.coerce.number().int().positive(),
  classId: z.string().uuid().optional().nullable(),
  assignmentId: z.string().uuid().optional().nullable(),
});

async function verifyStudentClassAccess(
  context: Exclude<
    Awaited<ReturnType<typeof requireWorkflowContext>>,
    NextResponse
  >,
  classId: string,
) {
  if (!context.profileId) return false;

  const { data, error } = await context.supabase
    .from("enrollments")
    .select("id")
    .eq("org_id", context.session.orgId)
    .eq("class_id", classId)
    .eq("student_id", context.profileId)
    .maybeSingle();

  return !error && Boolean(data);
}

async function verifyStudentAssignmentAccess(
  context: Exclude<
    Awaited<ReturnType<typeof requireWorkflowContext>>,
    NextResponse
  >,
  assignmentId: string,
) {
  if (!context.profileId) return false;

  const { data: assignment, error: assignmentError } = await context.supabase
    .from("assignments")
    .select("id,class_id")
    .eq("id", assignmentId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (assignmentError || !assignment?.class_id) return false;
  return verifyStudentClassAccess(context, String(assignment.class_id));
}

export async function POST(request: Request) {
  const context = await requireWorkflowContext([
    "student",
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

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "File upload details are invalid." },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const validation =
    body.purpose === "class_banner"
      ? validateClassBannerUpload({
          name: body.fileName,
          type: body.mimeType,
          size: body.fileSize,
        })
      : validateTeacherUpload({
          name: body.fileName,
          type: body.mimeType,
          size: body.fileSize,
        });
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: validation.error },
      { status: 400 },
    );
  }

  if (
    ["class_banner", "teacher_resource", "assignment_attachment"].includes(
      body.purpose,
    ) &&
    !isTeacherRole(context.session.role)
  ) {
    return NextResponse.json(
      { ok: false, error: "Forbidden." },
      { status: 403 },
    );
  }

  if (
    ["student_submission", "student_note"].includes(body.purpose) &&
    context.session.role !== "student" &&
    !isAdminRole(context.session.role)
  ) {
    return NextResponse.json(
      { ok: false, error: "Forbidden." },
      { status: 403 },
    );
  }

  if (
    (body.purpose === "class_banner" ||
      body.purpose === "teacher_resource" ||
      body.purpose === "assignment_attachment") &&
    body.classId
  ) {
    const classAccess = await requireClassAccess(context, body.classId);
    if (classAccess && isWorkflowResponse(classAccess)) return classAccess;
  }

  if (body.purpose === "student_note" && body.classId) {
    const allowed = await verifyStudentClassAccess(context, body.classId);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "You can only attach notes to your own classes." },
        { status: 403 },
      );
    }
  }

  if (body.purpose === "student_submission") {
    if (!body.assignmentId) {
      return NextResponse.json(
        { ok: false, error: "Assignment is required." },
        { status: 400 },
      );
    }

    const allowed = await verifyStudentAssignmentAccess(
      context,
      body.assignmentId,
    );
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "You are not enrolled in this assignment class." },
        { status: 403 },
      );
    }
  }

  const safeName = safeStorageName(body.fileName);
  const bucket: UploadedFileMetadata["bucket"] =
    body.purpose === "student_submission"
      ? "submissions"
      : body.purpose === "class_banner"
        ? "avatars"
        : "resources";
  const prefix =
    body.purpose === "class_banner"
      ? "class-banners"
      : body.purpose === "assignment_attachment"
      ? "assignments"
      : body.purpose === "student_note"
        ? "student-notes"
        : body.purpose === "student_submission"
          ? "submissions"
          : "resources";
  const filePath =
    body.purpose === "student_submission"
      ? `${context.session.orgId}/${prefix}/${context.profileId}/${body.assignmentId}/${randomUUID()}-${safeName}`
      : `${context.session.orgId}/${prefix}/${context.profileId}/${randomUUID()}-${safeName}`;

  const { data, error } = await context.supabase.storage
    .from(bucket)
    .createSignedUploadUrl(filePath, { upsert: false });

  if (error || !data?.token) {
    return NextResponse.json(
      { ok: false, error: "Unable to prepare secure upload." },
      { status: 500 },
    );
  }

  const publicUrl =
    body.purpose === "class_banner"
      ? context.supabase.storage.from(bucket).getPublicUrl(data.path ?? filePath)
          .data.publicUrl
      : null;

  return NextResponse.json({
    ok: true,
    upload: {
      bucket,
      path: data.path ?? filePath,
      name: body.fileName,
      size: body.fileSize,
      mimeType: body.mimeType,
      token: data.token,
      publicUrl,
    },
  });
}
