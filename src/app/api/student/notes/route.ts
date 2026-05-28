import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import {
  resourceTypeFromMime,
  safeStorageName,
  validateTeacherUpload,
} from "@/lib/server/upload-validation";

export const runtime = "nodejs";

type DbError = { code?: string; message?: string };

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isMissingColumn(error: unknown, column: string) {
  const candidate = error as DbError | null;

  return (
    candidate?.code === "42703" ||
    candidate?.code === "PGRST204" ||
    Boolean(candidate?.message?.includes(column))
  );
}

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

export async function POST(request: Request) {
  const context = await requireWorkflowContext(["student"]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  const formData = await request.formData();
  const title = textValue(formData, "title");
  const body = textValue(formData, "body") || null;
  const classId = textValue(formData, "classId") || null;
  const externalUrl = textValue(formData, "externalUrl") || null;
  const file = formData.get("file");

  if (!title) {
    return NextResponse.json(
      { ok: false, error: "Add a note title." },
      { status: 400 },
    );
  }

  if (classId && !(await verifyStudentClassAccess(context, classId))) {
    return NextResponse.json(
      { ok: false, error: "You can only attach notes to your own classes." },
      { status: 403 },
    );
  }

  let filePath: string | null = null;
  let fileSize: number | null = null;
  let mimeType: string | null = null;
  let originalFilename: string | null = null;
  let resourceType = externalUrl ? "link" : "rich_note";

  if (file instanceof File && file.size > 0) {
    const validation = validateTeacherUpload(file);
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 },
      );
    }

    const safeName = safeStorageName(file.name);
    filePath = `${context.session.orgId}/student-notes/${context.profileId}/${randomUUID()}-${safeName}`;
    fileSize = file.size;
    mimeType = file.type;
    originalFilename = file.name;
    resourceType = resourceTypeFromMime(file.type);

    const { error: uploadError } = await context.supabase.storage
      .from("resources")
      .upload(filePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: "Unable to upload note file." },
        { status: 500 },
      );
    }
  }

  const metadata = {
    owner_profile_id: context.profileId,
    owner_role: "student",
    visibility: classId ? "class" : "private",
  };

  const insertPayload = {
    org_id: context.session.orgId,
    class_id: classId,
    subject_id: null,
    teacher_id: null,
    title,
    type: resourceType,
    body,
    file_path: filePath,
    external_url: externalUrl,
    file_size: fileSize,
    mime_type: mimeType,
    original_filename: originalFilename,
    metadata,
    moderation_status: "approved",
  };

  let result = await context.supabase
    .from("resources")
    .insert(insertPayload)
    .select("id,title,created_at")
    .single();

  if (
    result.error &&
    (isMissingColumn(result.error, "metadata") ||
      isMissingColumn(result.error, "external_url") ||
      isMissingColumn(result.error, "file_size"))
  ) {
    result = await context.supabase
      .from("resources")
      .insert({
        org_id: context.session.orgId,
        class_id: classId,
        subject_id: null,
        teacher_id: null,
        title,
        type: resourceType,
        body,
        file_path: filePath,
        moderation_status: "approved",
      })
      .select("id,title,created_at")
      .single();
  }

  if (result.error) {
    if (filePath) {
      await context.supabase.storage.from("resources").remove([filePath]);
    }

    return NextResponse.json(
      { ok: false, error: "Unable to save note." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "student.note.created",
    entity: "resources",
    entityId: result.data.id as string,
    metadata: { classId, filePath, visibility: metadata.visibility },
  });

  return NextResponse.json({ ok: true, note: result.data });
}
