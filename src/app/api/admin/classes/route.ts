import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const classSchema = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(500).nullable().optional(),
  bannerUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  section: z.string().trim().max(60).nullable().optional(),
  gradeLevel: z.string().trim().max(100).nullable().optional(),
  batch: z.string().trim().max(100).nullable().optional(),
  term: z.string().trim().max(100).nullable().optional(),
  deliveryMode: z.enum(["physical", "online", "hybrid"]).default("hybrid"),
  capacity: z.number().int().min(1).max(10000).nullable().optional(),
  scheduleNote: z.string().trim().max(500).nullable().optional(),
  teacherId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const context = await requireWorkflowContext(["admin", "super_admin"]);
  if (isWorkflowResponse(context)) return context;

  const parsed = classSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Class details are invalid." },
      { status: 400 },
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

  const { data, error } = await context.supabase
    .from("classes")
    .insert({
      org_id: context.session.orgId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      banner_url: parsed.data.bannerUrl || null,
      section: parsed.data.section || null,
      grade_level: parsed.data.gradeLevel || null,
      batch: parsed.data.batch || null,
      term: parsed.data.term || null,
      delivery_mode: parsed.data.deliveryMode,
      capacity: parsed.data.capacity ?? null,
      schedule_note: parsed.data.scheduleNote || null,
      teacher_id: parsed.data.teacherId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "Unable to create class." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "admin.class.created",
    entity: "classes",
    entityId: data.id,
    metadata: { name: parsed.data.name },
  });

  return NextResponse.json({ ok: true, id: data.id });
}
