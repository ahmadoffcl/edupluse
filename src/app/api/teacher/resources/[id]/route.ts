import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireResourceAccess,
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

const patchSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  classId: z.string().uuid().optional().nullable(),
  subjectId: z.string().uuid().optional().nullable(),
  body: z.string().trim().max(8000).optional().nullable(),
  externalUrl: z.string().url().optional().nullable(),
});

function optionalText(formData: FormData, key: string) {
  if (!formData.has(key)) return undefined;
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : undefined;
}

export async function GET(
  _request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await contextParams.params;
  const access = await requireResourceAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  let signedUrl: string | null = null;
  if (access.file_path) {
    const { data } = await context.supabase.storage
      .from("resources")
      .createSignedUrl(access.file_path, 60 * 10);
    signedUrl = data?.signedUrl ?? null;
  }

  return NextResponse.json({ ok: true, resource: access, signedUrl });
}

export async function PATCH(
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
  const access = await requireResourceAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const contentType = request.headers.get("content-type") ?? "";
  let body: z.infer<typeof patchSchema>;
  let replacementFile: {
    path: string;
    size: number;
    mimeType: string;
    name: string;
    serverUploaded: boolean;
  } | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = patchSchema.parse({
        title: optionalText(formData, "title"),
        classId: optionalText(formData, "classId"),
        subjectId: optionalText(formData, "subjectId"),
        body: optionalText(formData, "body"),
        externalUrl: optionalText(formData, "externalUrl"),
      });

      const uploadedFile = parseUploadedFileMetadata(
        formData.get("uploadedFile"),
      );
      const file = formData.get("file");

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

        replacementFile = {
          path: uploadedFile.path,
          size: uploadedFile.size,
          mimeType: uploadedFile.mimeType,
          name: uploadedFile.name,
          serverUploaded: false,
        };
      } else if (file instanceof File && file.size > 0) {
        const validation = validateTeacherUpload(file);
        if (!validation.ok) {
          return NextResponse.json(
            { ok: false, error: validation.error },
            { status: 400 },
          );
        }

        const safeName = safeStorageName(file.name);
        const filePath = `${context.session.orgId}/resources/${context.profileId}/${randomUUID()}-${safeName}`;
        const { error: uploadError } = await context.supabase.storage
          .from("resources")
          .upload(filePath, Buffer.from(await file.arrayBuffer()), {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          return NextResponse.json(
            { ok: false, error: "Unable to upload replacement file." },
            { status: 500 },
          );
        }

        replacementFile = {
          path: filePath,
          size: file.size,
          mimeType: file.type,
          name: file.name,
          serverUploaded: true,
        };
      }
    } else {
      body = patchSchema.parse(await request.json());
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Resource details are invalid." },
      { status: 400 },
    );
  }

  const classAccess = await requireClassAccess(context, body.classId);
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

  const fileUpdate = replacementFile
    ? {
        file_path: replacementFile.path,
        file_size: replacementFile.size,
        mime_type: replacementFile.mimeType,
        original_filename: replacementFile.name,
        type: resourceTypeFromMime(replacementFile.mimeType),
        external_url: null,
      }
    : {};

  const { data, error } = await context.supabase
    .from("resources")
    .update({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.classId !== undefined ? { class_id: body.classId } : {}),
      ...(body.subjectId !== undefined ? { subject_id: body.subjectId } : {}),
      ...(body.body !== undefined ? { body: body.body || null } : {}),
      ...(body.externalUrl !== undefined
        ? { external_url: body.externalUrl || null }
        : {}),
      ...fileUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId)
    .select("id,title,type")
    .single();

  if (error) {
    if (replacementFile) {
      await context.supabase.storage
        .from("resources")
        .remove([replacementFile.path]);
    }

    return NextResponse.json(
      { ok: false, error: "Unable to update resource." },
      { status: 500 },
    );
  }

  if (
    replacementFile &&
    access.file_path &&
    access.file_path !== replacementFile.path
  ) {
    await context.supabase.storage.from("resources").remove([access.file_path]);
  }

  await writeAuditLog(context, {
    action: "teacher.resource.updated",
    entity: "resources",
    entityId: id,
    metadata: {
      classId: body.classId ?? access.class_id,
      replacedFile: Boolean(replacementFile),
    },
  });

  return NextResponse.json({ ok: true, resource: data });
}

export async function DELETE(
  _request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await contextParams.params;
  const access = await requireResourceAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const { error } = await context.supabase
    .from("resources")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to archive resource." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.resource.archived",
    entity: "resources",
    entityId: id,
    metadata: { filePath: access.file_path },
  });

  return NextResponse.json({ ok: true });
}
