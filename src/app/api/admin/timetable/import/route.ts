import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import { parseTimetablePdf } from "@/lib/timetable/parser";
import { TIMETABLE_TIMEZONE, type ParsedTimetableSlot } from "@/lib/timetable/types";

export const runtime = "nodejs";

type DbRecord = Record<string, unknown>;

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

function sectionLetter(sectionLabel: string) {
  const match = /\bSec\s+([A-Z])\b/i.exec(sectionLabel);
  return match?.[1]?.toLowerCase() ?? "";
}

function classMatchScore(slot: ParsedTimetableSlot, classRecord: DbRecord) {
  let score = 0;
  const section = stringValue(classRecord.section).toLowerCase();
  const haystack = [
    classRecord.name,
    classRecord.grade_level,
    classRecord.batch,
    classRecord.term,
  ]
    .map((value) => stringValue(value).toLowerCase())
    .join(" ");

  if (section && section === sectionLetter(slot.sectionLabel)) score += 4;
  if (haystack.includes(slot.semesterLabel.toLowerCase())) score += 3;
  if (haystack.includes(slot.intake.toLowerCase())) score += 3;
  if (haystack.includes(slot.program.toLowerCase())) score += 2;
  if (haystack.includes(slot.sectionKey)) score += 5;

  return score;
}

function bestClassId(slot: ParsedTimetableSlot, classes: DbRecord[]) {
  const ranked = classes
    .map((classRecord) => ({
      id: stringValue(classRecord.id),
      score: classMatchScore(slot, classRecord),
    }))
    .filter((item) => item.id && item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.id ?? null;
}

export async function POST(request: Request) {
  const context = await requireWorkflowContext(["admin", "super_admin"]);
  if (isWorkflowResponse(context)) return context;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Upload a timetable PDF first." },
      { status: 400 },
    );
  }

  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json(
      { ok: false, error: "Only PDF timetable files are supported." },
      { status: 400 },
    );
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const parsed = await parseTimetablePdf(data);

  if (parsed.sections.length === 0 || parsed.slots.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "The timetable was read, but no class slots were detected. Try a clearer timetable PDF.",
      },
      { status: 422 },
    );
  }

  const { data: classes } = await context.supabase
    .from("classes")
    .select("id,name,section,grade_level,batch,term")
    .eq("org_id", context.session.orgId)
    .limit(1000);

  const { data: importRow, error: importError } = await context.supabase
    .from("timetable_imports")
    .insert({
      org_id: context.session.orgId,
      created_by: context.profileId,
      original_filename: file.name,
      file_size: file.size,
      status: "draft",
      timezone: TIMETABLE_TIMEZONE,
      effective_from: parsed.sections.find((section) => section.effectiveFrom)
        ?.effectiveFrom,
      detected_sections: parsed.sections,
      raw_preview: parsed.rawPreview,
    })
    .select("id,original_filename,status,timezone,effective_from,detected_sections,created_at,published_at")
    .single();

  if (importError || !importRow) {
    if (isMissingTimetableTable(importError)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Timetable storage is not ready yet. Run the latest Supabase migration first.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unable to save timetable import." },
      { status: 500 },
    );
  }

  const classRows = ((classes ?? []) as DbRecord[]);
  const slotRows = parsed.slots.map((slot) => {
    const classId = bestClassId(slot, classRows);
    const ready = Boolean(classId && slot.startTime && slot.endTime);

    return {
      import_id: importRow.id,
      org_id: context.session.orgId,
      class_id: classId,
      section_key: slot.sectionKey,
      section_label: slot.sectionLabel,
      program: slot.program,
      intake: slot.intake,
      semester_label: slot.semesterLabel,
      day_of_week: slot.dayOfWeek,
      start_time: slot.startTime,
      end_time: slot.endTime,
      subject_name: slot.subjectName,
      teacher_name: slot.teacherName,
      venue: slot.venue,
      timezone: TIMETABLE_TIMEZONE,
      effective_from: slot.effectiveFrom,
      active: ready,
      confidence: slot.confidence,
      review_status: ready ? "ready" : "needs_review",
      metadata: slot.metadata,
    };
  });

  const { data: insertedSlots, error: slotError } = await context.supabase
    .from("timetable_slots")
    .insert(slotRows)
    .select(
      "id,import_id,class_id,section_key,section_label,day_of_week,start_time,end_time,subject_name,teacher_name,venue,active,confidence,review_status",
    );

  if (slotError) {
    return NextResponse.json(
      { ok: false, error: "Unable to save timetable slots." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "timetable.imported",
    entity: "timetable_imports",
    entityId: stringValue(importRow.id),
    metadata: {
      sections: parsed.sections.length,
      slots: insertedSlots?.length ?? 0,
      filename: file.name,
    },
  });

  return NextResponse.json({
    ok: true,
    import: {
      id: stringValue(importRow.id),
      originalFilename: stringValue(importRow.original_filename, file.name),
      status: stringValue(importRow.status, "draft"),
      timezone: stringValue(importRow.timezone, TIMETABLE_TIMEZONE),
      effectiveFrom: stringValue(importRow.effective_from) || null,
      detectedSections: parsed.sections,
      createdAt: stringValue(importRow.created_at),
      publishedAt: stringValue(importRow.published_at) || null,
    },
    slots: ((insertedSlots ?? []) as DbRecord[]).map((row) => ({
      id: stringValue(row.id),
      importId: stringValue(row.import_id),
      classId: stringValue(row.class_id) || null,
      sectionKey: stringValue(row.section_key),
      sectionLabel: stringValue(row.section_label),
      dayOfWeek: Number(row.day_of_week) || 1,
      startTime: stringValue(row.start_time).slice(0, 5) || null,
      endTime: stringValue(row.end_time).slice(0, 5) || null,
      subjectName: stringValue(row.subject_name, "Class"),
      teacherName: stringValue(row.teacher_name) || null,
      venue: stringValue(row.venue) || null,
      active: Boolean(row.active),
      confidence: Number(row.confidence) || 0.5,
      reviewStatus: stringValue(row.review_status, "needs_review"),
    })),
  });
}
