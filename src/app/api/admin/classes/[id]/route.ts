import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const classSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  bannerUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  section: z.string().trim().max(60).nullable().optional(),
  gradeLevel: z.string().trim().max(100).nullable().optional(),
  batch: z.string().trim().max(100).nullable().optional(),
  term: z.string().trim().max(100).nullable().optional(),
  deliveryMode: z.enum(["physical", "online", "hybrid"]).optional(),
  capacity: z.number().int().min(1).max(10000).nullable().optional(),
  scheduleNote: z.string().trim().max(500).nullable().optional(),
  teacherId: z.string().uuid().nullable().optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const context = await requireWorkflowContext(["admin", "super_admin"]);
  if (isWorkflowResponse(context)) return context;

  const parsed = classSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Class details are invalid." },
      { status: 400 },
    );
  }

  const { data: classRecord } = await context.supabase
    .from("classes")
    .select("id,name")
    .eq("org_id", context.session.orgId)
    .eq("id", id)
    .maybeSingle();

  if (!classRecord) {
    return NextResponse.json(
      { ok: false, error: "Class was not found." },
      { status: 404 },
    );
  }

  if (parsed.data.teacherId) {
    const { data: teacherMembership } = await context.supabase
      .from("memberships")
      .select("id")
      .eq("org_id", context.session.orgId)
      .eq("profile_id", parsed.data.teacherId)
      .in("role", ["teacher", "admin", "super_admin"])
      .eq("status", "active")
      .maybeSingle();

    if (!teacherMembership) {
      return NextResponse.json(
        { ok: false, error: "Choose a teacher from this institute." },
        { status: 400 },
      );
    }
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.name !== undefined) payload.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    payload.description = parsed.data.description || null;
  }
  if (parsed.data.bannerUrl !== undefined) {
    payload.banner_url = parsed.data.bannerUrl || null;
  }
  if (parsed.data.section !== undefined) {
    payload.section = parsed.data.section || null;
  }
  if (parsed.data.gradeLevel !== undefined) {
    payload.grade_level = parsed.data.gradeLevel || null;
  }
  if (parsed.data.batch !== undefined) {
    payload.batch = parsed.data.batch || null;
  }
  if (parsed.data.term !== undefined) {
    payload.term = parsed.data.term || null;
  }
  if (parsed.data.deliveryMode !== undefined) {
    payload.delivery_mode = parsed.data.deliveryMode;
  }
  if (parsed.data.capacity !== undefined) {
    payload.capacity = parsed.data.capacity ?? null;
  }
  if (parsed.data.scheduleNote !== undefined) {
    payload.schedule_note = parsed.data.scheduleNote || null;
  }
  if (parsed.data.teacherId !== undefined) {
    payload.teacher_id = parsed.data.teacherId ?? null;
  }
  if (parsed.data.archived !== undefined) {
    payload.archived_at = parsed.data.archived
      ? new Date().toISOString()
      : null;
  }

  const { error } = await context.supabase
    .from("classes")
    .update(payload)
    .eq("org_id", context.session.orgId)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to update class." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: parsed.data.archived ? "admin.class.archived" : "admin.class.updated",
    entity: "classes",
    entityId: id,
    metadata: { previousName: classRecord.name },
  });

  return NextResponse.json({ ok: true });
}
