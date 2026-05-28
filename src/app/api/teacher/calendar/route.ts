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
  classId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2).max(180),
  kind: z.enum(["exam", "assignment", "event", "holiday", "live"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
});

export async function POST(request: Request) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const body = schema.parse(await request.json());
  const classAccess = await requireClassAccess(context, body.classId);
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

  const { data, error } = await context.supabase
    .from("calendar_events")
    .insert({
      org_id: context.session.orgId,
      class_id: body.classId || null,
      owner_id: context.profileId,
      title: body.title,
      kind: body.kind,
      starts_at: body.startsAt,
      ends_at: body.endsAt || null,
    })
    .select("id,title,kind,starts_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to create calendar event." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.calendar.created",
    entity: "calendar_events",
    entityId: data.id,
    metadata: { classId: body.classId || null, kind: body.kind },
  });

  return NextResponse.json({ ok: true, event: data });
}
