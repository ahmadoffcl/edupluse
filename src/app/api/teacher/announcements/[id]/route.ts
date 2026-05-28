import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireAnnouncementAccess,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const patchSchema = z.object({
  classId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2).max(180).optional(),
  body: z.string().trim().min(2).max(4000).optional(),
});

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
  const access = await requireAnnouncementAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const body = patchSchema.parse(await request.json());
  const classAccess = await requireClassAccess(context, body.classId);
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

  const { data, error } = await context.supabase
    .from("announcements")
    .update({
      ...(body.classId !== undefined ? { class_id: body.classId } : {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.body !== undefined ? { body: body.body } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId)
    .select("id,title,body")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to update announcement." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.announcement.updated",
    entity: "announcements",
    entityId: id,
    metadata: { classId: body.classId ?? access.class_id },
  });

  return NextResponse.json({ ok: true, announcement: data });
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
  const access = await requireAnnouncementAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const { error } = await context.supabase
    .from("announcements")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to archive announcement." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.announcement.archived",
    entity: "announcements",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
