import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import {
  BUILTIN_TIMETABLE_IMPORT_ID,
  builtInImportRow,
  loadBuiltInTimetable,
  mapBuiltInSlot,
} from "@/lib/timetable/builtin";
import { normalizeTimetableTime } from "@/lib/timetable/matching";
import { materializeTimetableNotifications } from "@/lib/timetable/scheduler";

export const runtime = "nodejs";

const timeSchema = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/)
  .transform((value) => normalizeTimetableTime(value) ?? value);

const slotSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid().nullable().optional(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: timeSchema.nullable().optional(),
  endTime: timeSchema.nullable().optional(),
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

function isMissingTimetableTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(candidate.message?.includes("timetable_"))
  );
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

  let importRow: { id: string; status?: string | null } | null = null;
  let importError: unknown = null;

  if (id === BUILTIN_TIMETABLE_IMPORT_ID) {
    const builtIn = await loadBuiltInTimetable();
    if (!builtIn) {
      return NextResponse.json(
        { ok: false, error: "The built-in timetable is unavailable." },
        { status: 500 },
      );
    }

    const { data: classes } = await context.supabase
      .from("classes")
      .select("id,name,section,grade_level,batch,term")
      .eq("org_id", context.session.orgId)
      .limit(1000);

    const { data: savedImport, error: saveImportError } = await context.supabase
      .from("timetable_imports")
      .upsert(
        {
          ...builtInImportRow(
            builtIn,
            context.session.orgId,
            context.profileId,
          ),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select("id,status")
      .single();

    if (saveImportError) {
      const message = isMissingTimetableTable(saveImportError)
        ? "Timetable storage is not ready yet. Run the latest Supabase migration first."
        : "Unable to save the built-in timetable.";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }

    const updatesById = new Map(
      parsed.data.slots.map((slot) => [slot.id, slot]),
    );
    const slotRows = builtIn.slots.map((slot) => {
      const row = mapBuiltInSlot(
        slot,
        (classes ?? []) as Record<string, unknown>[],
        {
          orgId: context.session.orgId,
        },
      );
      const update = updatesById.get(row.id);
      const active = update?.active ?? row.active;
      const classId = update?.classId ?? row.class_id ?? null;
      const startTime =
        update?.startTime ?? (stringValue(row.start_time) || null);
      const endTime = update?.endTime ?? (stringValue(row.end_time) || null);
      const ready = Boolean(active && classId && startTime && endTime);

      return {
        ...row,
        class_id: classId,
        day_of_week: update?.dayOfWeek ?? row.day_of_week,
        start_time: startTime,
        end_time: endTime,
        subject_name: update?.subjectName ?? row.subject_name,
        teacher_name: update?.teacherName || row.teacher_name,
        venue: update?.venue || row.venue,
        active: ready,
        review_status: ready ? "ready" : "ignored",
        updated_at: new Date().toISOString(),
      };
    });

    const { error: saveSlotsError } = await context.supabase
      .from("timetable_slots")
      .upsert(slotRows, { onConflict: "id" });

    if (saveSlotsError) {
      return NextResponse.json(
        { ok: false, error: "Unable to save the built-in timetable rows." },
        { status: 500 },
      );
    }

    importRow = savedImport;
  } else {
    const result = await context.supabase
      .from("timetable_imports")
      .select("id,status")
      .eq("org_id", context.session.orgId)
      .eq("id", id)
      .maybeSingle();
    importRow = result.data;
    importError = result.error;
  }

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
