import "server-only";
import { extractPdfText } from "@/lib/server/pdf-text";
import type {
  ParsedTimetableSlot,
  TimetableSection,
} from "@/lib/timetable/types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_TO_NUMBER = new Map(DAY_NAMES.map((day, index) => [day, index + 1]));

const SECTION_RE =
  /Intake\s+([A-Z]+-\d{4})\s+(CS)\s+(\d+(?:st|nd|rd|th))\s+Sec\s+([A-Z])\s+\(w\.e\.f\s+([^)]+?)\)\s+\(Version-([\d.]+)\)/i;

const TIME_RE = /(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/g;

type TimeRange = {
  start: string;
  end: string;
};

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSectionKey(section: TimetableSection) {
  return [
    section.intake,
    section.program,
    section.semesterLabel,
    `sec-${section.section}`,
  ]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseEffectiveDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function normalizeTime(value: string) {
  const [hour, minute] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute}`;
}

function parseSection(line: string): TimetableSection | null {
  const match = SECTION_RE.exec(line);
  if (!match) return null;

  const [, intake, program, semesterLabel, section, effectiveFrom, version] =
    match;
  const sectionLabel = `Intake ${intake} ${program} ${semesterLabel} Sec ${section}`;
  const parsed: TimetableSection = {
    sectionKey: "",
    sectionLabel,
    intake,
    program,
    semesterLabel,
    section,
    effectiveFrom: parseEffectiveDate(effectiveFrom),
    version,
  };
  parsed.sectionKey = normalizeSectionKey(parsed);
  return parsed;
}

function parseTimes(header: string): TimeRange[] {
  const ranges: TimeRange[] = [];
  for (const match of header.matchAll(TIME_RE)) {
    ranges.push({
      start: normalizeTime(match[1]),
      end: normalizeTime(match[2]),
    });
  }
  return ranges;
}

function looksLikeVenue(line: string) {
  return /classroom|lab|block|online|seminar|auditorium|venue/i.test(line);
}

function looksLikeTeacher(line: string) {
  return /^(mr|ms|mrs|dr|engr|prof)\.?\s+/i.test(line);
}

function isNoise(line: string) {
  return (
    !line ||
    /^DAY\b/i.test(line) ||
    /^-- \d+ of \d+ --$/.test(line) ||
    /chairperson|department of computer science|hitec university/i.test(line) ||
    /time table for spring/i.test(line) ||
    /university events|extra curricular/i.test(line) ||
    /^\d+\.\s/.test(line)
  );
}

function isDay(line: string) {
  return DAY_TO_NUMBER.has(line);
}

function trimSegment(lines: string[]) {
  return lines
    .map(cleanLine)
    .filter((line) => !isNoise(line))
    .filter((line) => !/^juma break$/i.test(line))
    .filter((line) => !/^\(online\)$/i.test(line));
}

function extractTriples(lines: string[]) {
  const triples: Array<{
    subjectName: string;
    teacherName: string | null;
    venue: string | null;
  }> = [];

  const segment = trimSegment(lines);
  for (let index = 0; index < segment.length; index += 1) {
    const subject = segment[index];
    const teacher = segment[index + 1];
    const venue = segment[index + 2];

    if (!subject || !teacher || !venue) continue;
    if (!looksLikeTeacher(teacher) || !looksLikeVenue(venue)) continue;
    if (/break/i.test(subject) || /break/i.test(teacher)) continue;

    triples.push({
      subjectName: subject,
      teacherName: teacher,
      venue,
    });
    index += 2;
  }

  return triples;
}

function parseDayBlock(
  lines: string[],
  section: TimetableSection,
  page: number,
) {
  const header = lines[0] ?? "";
  const timeRanges = parseTimes(header);
  const slots: ParsedTimetableSlot[] = [];
  let currentDay: string | null = null;
  let currentLines: string[] = [];

  function flush() {
    if (!currentDay) return;
    const dayOfWeek = DAY_TO_NUMBER.get(currentDay);
    if (!dayOfWeek) return;

    const triples = extractTriples(currentLines);
    triples.forEach((triple, index) => {
      const range = timeRanges[index] ?? null;
      slots.push({
        ...section,
        dayOfWeek,
        startTime: range?.start ?? null,
        endTime: range?.end ?? null,
        subjectName: triple.subjectName,
        teacherName: triple.teacherName,
        venue: triple.venue,
        confidence: range ? 0.58 : 0.35,
        metadata: {
          page,
          inferredTime: true,
          source: "pdf-text-order",
        },
      });
    });
  }

  for (const line of lines.slice(1).map(cleanLine)) {
    if (isDay(line)) {
      flush();
      currentDay = line;
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  flush();
  return slots;
}

function pageDayBlocks(lines: string[]) {
  const startIndexes = lines
    .map((line, index) => (/^DAY\b/.test(line) ? index : -1))
    .filter((index) => index >= 0);

  return startIndexes.map((startIndex, blockIndex) => {
    const nextStart = startIndexes[blockIndex + 1] ?? lines.length;
    const hardEnd = lines.findIndex(
      (line, index) =>
        index > startIndex &&
        (/^Assoc\./i.test(line) ||
          /^HITEC UNIVERSITY/i.test(line) ||
          /^Intake\s+/i.test(line)),
    );
    const endIndex =
      hardEnd > startIndex && hardEnd < nextStart ? hardEnd : nextStart;
    return lines.slice(startIndex, endIndex);
  });
}

export type ParsedTimetable = {
  sections: TimetableSection[];
  slots: ParsedTimetableSlot[];
  rawPreview: string;
  pageCount: number;
};

export async function parseTimetablePdf(
  data: Uint8Array,
): Promise<ParsedTimetable> {
  const result = await extractPdfText(data, {
    cellSeparator: " ",
    pageJoiner: "",
  });

  const sectionsByKey = new Map<string, TimetableSection>();
  const slots: ParsedTimetableSlot[] = [];

  for (const page of result.pages) {
    const lines = page.text.split(/\r?\n/).map(cleanLine).filter(Boolean);
    const sections = lines
      .map(parseSection)
      .filter(Boolean) as TimetableSection[];
    for (const section of sections)
      sectionsByKey.set(section.sectionKey, section);

    const blocks = pageDayBlocks(lines);
    blocks.forEach((block, index) => {
      const section = sections[index];
      if (!section) return;
      slots.push(...parseDayBlock(block, section, page.num));
    });
  }

  return {
    sections: Array.from(sectionsByKey.values()),
    slots,
    rawPreview: result.text.slice(0, 4000),
    pageCount: result.total,
  };
}
