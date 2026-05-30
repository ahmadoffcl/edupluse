import type { ParsedTimetableSlot } from "@/lib/timetable/types";

type DbRecord = Record<string, unknown>;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function normalizeTimetableTime(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value.slice(0, 5);
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function sectionLetter(sectionLabel: string) {
  const match = /\bSec\s+([A-Z])\b/i.exec(sectionLabel);
  return match?.[1]?.toLowerCase() ?? "";
}

export function classMatchScore(
  slot: ParsedTimetableSlot,
  classRecord: DbRecord,
) {
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

export function bestClassId(
  slot: ParsedTimetableSlot,
  classes: DbRecord[],
  options: { minScore?: number } = {},
) {
  const minScore = options.minScore ?? 1;
  const ranked = classes
    .map((classRecord) => ({
      id: stringValue(classRecord.id),
      score: classMatchScore(slot, classRecord),
    }))
    .filter((item) => item.id && item.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.id ?? null;
}
