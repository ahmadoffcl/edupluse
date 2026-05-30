export const TIMETABLE_TIMEZONE = "Asia/Karachi";

export type TimetableSection = {
  sectionKey: string;
  sectionLabel: string;
  intake: string;
  program: string;
  semesterLabel: string;
  section: string;
  effectiveFrom: string | null;
  version: string | null;
};

export type ParsedTimetableSlot = TimetableSection & {
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  subjectName: string;
  teacherName: string | null;
  venue: string | null;
  confidence: number;
  metadata: Record<string, unknown>;
};

export type TimetableSession = {
  id: string;
  slotId: string;
  classId: string;
  className: string;
  sectionLabel: string;
  subjectName: string;
  teacherName: string | null;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  startReminderAt: string;
  endReminderAt: string;
  actionUrl: string;
  dedupeStartKey: string;
  dedupeEndKey: string;
};
