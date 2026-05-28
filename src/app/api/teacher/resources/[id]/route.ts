import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireResourceAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const patchSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  classId: z.string().uuid().optional().nullable(),
  subjectId: z.string().uuid().optional().nullable(),
  body: z.string().trim().max(8000).optional().nullable(),
  externalUrl: z.string().url().optional().nullable(),
});

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

  const body = patchSchema.parse(await request.json());
  const classAccess = await requireClassAccess(context, body.classId);
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId)
    .select("id,title,type")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to update resource." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.resource.updated",
    entity: "resources",
    entityId: id,
    metadata: { classId: body.classId ?? access.class_id },
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
