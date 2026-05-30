import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import {
  resourceTypeFromMime,
  safeStorageName,
  validateTeacherUpload,
} from "@/lib/server/upload-validation";
import {
  assertOrgStoragePath,
  parseUploadedFileMetadata,
} from "@/lib/server/uploaded-file";

export const runtime = "nodejs";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const formData = await request.formData();
  const title = textValue(formData, "title");
  const classId = textValue(formData, "classId") || null;
  const subjectId = textValue(formData, "subjectId") || null;
  const body = textValue(formData, "body") || null;
  const externalUrl = textValue(formData, "externalUrl") || null;
  const file = formData.get("file");
  const uploadedFile = parseUploadedFileMetadata(formData.get("uploadedFile"));

  if (!title) {
    return NextResponse.json(
      { ok: false, error: "Resource title is required." },
      { status: 400 },
    );
  }

  const classAccess = await requireClassAccess(context, classId);
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

  let filePath: string | null = null;
  let fileSize: number | null = null;
  let mimeType: string | null = null;
  let originalFilename: string | null = null;
  let resourceType = externalUrl ? "link" : "rich_note";

  if (uploadedFile) {
    const valid =
      assertOrgStoragePath({
        metadata: uploadedFile,
        orgId: context.session.orgId,
        bucket: "resources",
        prefix: "resources",
      }) &&
      uploadedFile.path.startsWith(
        `${context.session.orgId}/resources/${context.profileId}/`,
      );
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Uploaded material file is not valid." },
        { status: 400 },
      );
    }

    const validation = validateTeacherUpload({
      name: uploadedFile.name,
      type: uploadedFile.mimeType,
      size: uploadedFile.size,
    });
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 },
      );
    }

    filePath = uploadedFile.path;
    fileSize = uploadedFile.size;
    mimeType = uploadedFile.mimeType;
    originalFilename = uploadedFile.name;
    resourceType = resourceTypeFromMime(uploadedFile.mimeType);
  } else if (file instanceof File && file.size > 0) {
    const validation = validateTeacherUpload(file);
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 },
      );
    }

    const safeName = safeStorageName(file.name);
    filePath = `${context.session.orgId}/resources/${context.profileId}/${randomUUID()}-${safeName}`;
    const { error: uploadError } = await context.supabase.storage
      .from("resources")
      .upload(filePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: "Unable to upload resource file." },
        { status: 500 },
      );
    }

    fileSize = file.size;
    mimeType = file.type;
    originalFilename = file.name;
    resourceType = resourceTypeFromMime(file.type);
  }

  if (!filePath && !externalUrl && !body) {
    return NextResponse.json(
      { ok: false, error: "Add a file, link, or note body." },
      { status: 400 },
    );
  }

  const { data, error } = await context.supabase
    .from("resources")
    .insert({
      org_id: context.session.orgId,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: context.profileId,
      title,
      type: resourceType,
      body,
      file_path: filePath,
      external_url: externalUrl,
      file_size: fileSize,
      mime_type: mimeType,
      original_filename: originalFilename,
      moderation_status: "approved",
    })
    .select("id,title,type")
    .single();

  if (error) {
    if (filePath) {
      await context.supabase.storage.from("resources").remove([filePath]);
    }

    return NextResponse.json(
      { ok: false, error: "Unable to save resource." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.resource.created",
    entity: "resources",
    entityId: data.id,
    metadata: { classId, subjectId, resourceType, filePath },
  });

  return NextResponse.json({ ok: true, resource: data });
}
