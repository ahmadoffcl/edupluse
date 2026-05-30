import "server-only";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { bestClassId, normalizeTimetableTime } from "@/lib/timetable/matching";
import {
  parseTimetablePdf,
  type ParsedTimetable,
} from "@/lib/timetable/parser";
import {
  TIMETABLE_TIMEZONE,
  type ParsedTimetableSlot,
} from "@/lib/timetable/types";

type DbRecord = Record<string, unknown>;

export const BUILTIN_TIMETABLE_IMPORT_ID = uuidFromString(
  "edupulse:bscs-spring-2026:v3.2",
);
export const BUILTIN_TIMETABLE_FILENAME =
  "BSCS Hybrid Time Table Spring 2026 v3.2";
export const BUILTIN_TIMETABLE_PATH = path.join(
  process.cwd(),
  "public",
  "timetables",
  "bscs-spring-2026-v3.2.pdf",
);

let cachedTimetable: Promise<ParsedTimetable | null> | null = null;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function uuidFromString(value: string) {
  const bytes = Buffer.from(
    createHash("sha1").update(value).digest().subarray(0, 16),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function loadBuiltInTimetable() {
  cachedTimetable ??= readFile(BUILTIN_TIMETABLE_PATH)
    .then((buffer) => parseTimetablePdf(new Uint8Array(buffer)))
    .catch((error) => {
      console.error("Built-in timetable unavailable", error);
      return null;
    });

  return cachedTimetable;
}

export function builtInSlotId(slot: ParsedTimetableSlot) {
  return uuidFromString(
    [
      "edupulse:timetable-slot",
      slot.sectionKey,
      slot.dayOfWeek,
      normalizeTimetableTime(slot.startTime),
      normalizeTimetableTime(slot.endTime),
      slot.subjectName,
      slot.teacherName,
      slot.venue,
    ].join(":"),
  );
}

export function mapBuiltInSlot(
  slot: ParsedTimetableSlot,
  classes: DbRecord[],
  options: { orgId?: string; requireStrongMatch?: boolean } = {},
) {
  const classId = bestClassId(slot, classes, {
    minScore: options.requireStrongMatch ? 6 : 1,
  });
  const startTime = normalizeTimetableTime(slot.startTime);
  const endTime = normalizeTimetableTime(slot.endTime);
  const ready = Boolean(classId && startTime && endTime);

  return {
    id: builtInSlotId(slot),
    import_id: BUILTIN_TIMETABLE_IMPORT_ID,
    org_id: options.orgId,
    class_id: classId,
    section_key: slot.sectionKey,
    section_label: slot.sectionLabel,
    program: slot.program,
    intake: slot.intake,
    semester_label: slot.semesterLabel,
    day_of_week: slot.dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    subject_name: slot.subjectName,
    teacher_name: slot.teacherName,
    venue: slot.venue,
    timezone: TIMETABLE_TIMEZONE,
    effective_from: slot.effectiveFrom,
    active: ready,
    confidence: slot.confidence,
    review_status: ready ? "ready" : "needs_review",
    metadata: {
      ...slot.metadata,
      source: "built-in-bscs-spring-2026",
    },
  };
}

export function builtInImportRow(
  parsed: ParsedTimetable,
  orgId: string,
  profileId: string | null,
) {
  return {
    id: BUILTIN_TIMETABLE_IMPORT_ID,
    org_id: orgId,
    created_by: profileId,
    original_filename: BUILTIN_TIMETABLE_FILENAME,
    file_size: null,
    status: "draft",
    timezone: TIMETABLE_TIMEZONE,
    effective_from:
      parsed.sections.find((section) => section.effectiveFrom)?.effectiveFrom ??
      null,
    detected_sections: parsed.sections,
    raw_preview: parsed.rawPreview,
  };
}

export function rowClassName(
  classId: string | null | undefined,
  classes: DbRecord[],
) {
  if (!classId) return "Classroom";
  const match = classes.find(
    (classRecord) => stringValue(classRecord.id) === classId,
  );
  return stringValue(match?.name, "Classroom");
}
