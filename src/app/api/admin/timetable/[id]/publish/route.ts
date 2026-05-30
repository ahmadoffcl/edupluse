import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import { materializeTimetableNotifications } from "@/lib/timetable/scheduler";

export const runtime = "nodejs";

const slotSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid().nullable().optional(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  subjectName: z.string().trim().min(1).max(180),
  teacherName: z.string().trim().max(180).nullable().optional(),
  venue: z.string().trim().max(180).nullable().optional(),
  active: z.boolean().default(true),
});

const bodySchema = z.object({
  slots: z.array(slotSchema).min(1).max(1000),
});

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const context = await requireWorkflowContext(["admin", "super_admin"]);
  if (isWorkflowResponse(context)) return context;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Review the timetable rows before publishing." },
      { status: 400 },
    );
  }

  const { data: importRow, error: importError } = await context.supabase
    .from("timetable_imports")
    .select("id,status")
    .eq("org_id", context.session.orgId)
    .eq("id", id)
    .maybeSingle();

  if (importError || !importRow) {
    return NextResponse.json(
      { ok: false, error: "Timetable import was not found." },
      { status: 404 },
    );
  }

  let readyCount = 0;
  let ignoredCount = 0;

  for (const slot of parsed.data.slots) {
    const ready = Boolean(
      slot.active && slot.classId && slot.startTime && slot.endTime,
    );
    if (ready) readyCount += 1;
    else ignoredCount += 1;

    const { error } = await context.supabase
      .from("timetable_slots")
      .update({
        class_id: slot.classId ?? null,
        day_of_week: slot.dayOfWeek,
        start_time: slot.startTime ?? null,
        end_time: slot.endTime ?? null,
        subject_name: slot.subjectName,
        teacher_name: slot.teacherName || null,
        venue: slot.venue || null,
        active: ready,
        review_status: ready ? "ready" : "ignored",
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", context.session.orgId)
      .eq("import_id", id)
      .eq("id", slot.id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Unable to publish every timetable row." },
        { status: 500 },
      );
    }
  }

  if (readyCount === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "At least one row needs a class, start time, and end time.",
      },
      { status: 400 },
    );
  }

  const { error: publishError } = await context.supabase
    .from("timetable_imports")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      published_by: context.profileId,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", context.session.orgId)
    .eq("id", id);

  if (publishError) {
    return NextResponse.json(
      { ok: false, error: "Unable to publish timetable." },
      { status: 500 },
    );
  }

  const materialized = await materializeTimetableNotifications({
    supabase: context.supabase,
    orgId: context.session.orgId,
    from: new Date(Date.now() - 10 * 60 * 1000),
    to: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await writeAuditLog(context, {
    action: "timetable.published",
    entity: "timetable_imports",
    entityId: id,
    metadata: {
      readyCount,
      ignoredCount,
      materialized: materialized.inserted,
      materializeError: materialized.error,
      previousStatus: stringValue(importRow.status),
    },
  });

  return NextResponse.json({
    ok: true,
    readyCount,
    ignoredCount,
    materialized: materialized.inserted,
  });
}
