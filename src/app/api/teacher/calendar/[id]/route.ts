import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireCalendarAccess,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const patchSchema = z.object({
  classId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2).max(180).optional(),
  kind: z.enum(["exam", "assignment", "event", "holiday", "live"]).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
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
  const access = await requireCalendarAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const body = patchSchema.parse(await request.json());
  const classAccess = await requireClassAccess(context, body.classId);
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

  const { data, error } = await context.supabase
    .from("calendar_events")
    .update({
      ...(body.classId !== undefined ? { class_id: body.classId } : {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      ...(body.startsAt !== undefined ? { starts_at: body.startsAt } : {}),
      ...(body.endsAt !== undefined ? { ends_at: body.endsAt || null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId)
    .select("id,title,kind,starts_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to update calendar event." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.calendar.updated",
    entity: "calendar_events",
    entityId: id,
    metadata: { classId: body.classId ?? access.class_id },
  });

  return NextResponse.json({ ok: true, event: data });
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
  const access = await requireCalendarAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const { error } = await context.supabase
    .from("calendar_events")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to archive calendar event." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.calendar.archived",
    entity: "calendar_events",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
