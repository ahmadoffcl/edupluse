const QUIZ_PATTERN =
  /\b(quiz|test|exam|midterm|mid\s*term|final|viva|assessment|mcq|short\s*questions?)\b/i;

const MONTHS = new Map(
  [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ].map((month, index) => [month, index]),
);

export function classifyAssignmentKind({
  title,
  instructions,
}: {
  title?: string | null;
  instructions?: string | null;
}): "assignment" | "exam" {
  const text = [title, instructions].filter(Boolean).join(" ");
  return QUIZ_PATTERN.test(text) ? "exam" : "assignment";
}

export function assignmentKindLabel(kind: "assignment" | "exam") {
  return kind === "exam" ? "Quiz / exam" : "Assignment";
}

export function assignmentPostedTitle(kind: "assignment" | "exam") {
  return kind === "exam" ? "New quiz posted" : "New assignment";
}

export function assignmentReminderTitle(
  kind: "assignment" | "exam",
  timing: "tomorrow" | "hour",
) {
  if (kind === "exam") {
    return timing === "tomorrow" ? "Quiz is tomorrow" : "Quiz starts in 1 hour";
  }

  return timing === "tomorrow"
    ? "Assignment due tomorrow"
    : "Assignment due in 1 hour";
}

function timeFromText(text: string) {
  const match =
    text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) ??
    text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (!match) return { hour: 9, minute: 0, explicit: false };

  let hour = Number(match[1]);
  const minute = match[2] && /^\d+$/.test(match[2]) ? Number(match[2]) : 0;
  const meridiem = (match[3] ?? (/^\D+$/.test(match[2] ?? "") ? match[2] : ""))
    ?.toLowerCase()
    .trim();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return { hour: 9, minute: 0, explicit: false };
  return { hour, minute, explicit: true };
}

function karachiIso({
  year,
  month,
  day,
  hour,
  minute,
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00+05:00`).toISOString();
}

function extractLearningDate(text: string, now = new Date()) {
  const currentYear = Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Asia/Karachi",
    }).format(now),
  );
  const time = timeFromText(text);
  const normalized = text.toLowerCase();

  if (/\btomorrow\b/i.test(text)) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Karachi",
    }).formatToParts(tomorrow);
    const lookup = new Map(parts.map((part) => [part.type, part.value]));
    return {
      dueAt: karachiIso({
        year: Number(lookup.get("year")),
        month: Number(lookup.get("month")) - 1,
        day: Number(lookup.get("day")),
        hour: time.hour,
        minute: time.minute,
      }),
      explicitTime: time.explicit,
    };
  }

  const iso = normalized.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    return {
      dueAt: karachiIso({
        year: Number(iso[1]),
        month: Number(iso[2]) - 1,
        day: Number(iso[3]),
        hour: time.hour,
        minute: time.minute,
      }),
      explicitTime: time.explicit,
    };
  }

  const numeric = normalized.match(
    /\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/,
  );
  if (numeric) {
    return {
      dueAt: karachiIso({
        year: Number(numeric[3] ?? currentYear),
        month: Number(numeric[2]) - 1,
        day: Number(numeric[1]),
        hour: time.hour,
        minute: time.minute,
      }),
      explicitTime: time.explicit,
    };
  }

  const monthName = normalized.match(
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/,
  );
  if (monthName) {
    const day = Number(monthName[1] ?? monthName[4]);
    const monthKey = (monthName[2] ?? monthName[3]).slice(0, 3);
    const month = MONTHS.get(monthKey);
    if (month !== undefined) {
      return {
        dueAt: karachiIso({
          year: currentYear,
          month,
          day,
          hour: time.hour,
          minute: time.minute,
        }),
        explicitTime: time.explicit,
      };
    }
  }

  return null;
}

export function analyzeLearningPost({
  title,
  body,
  now,
}: {
  title?: string | null;
  body?: string | null;
  now?: Date;
}) {
  const text = [title, body].filter(Boolean).join(" ");
  if (!QUIZ_PATTERN.test(text)) {
    return {
      kind: null as null,
      dueAt: null,
      confidence: 0,
      reason: "No quiz, test, exam, or assessment keyword was found.",
    };
  }

  const date = extractLearningDate(text, now);
  if (!date?.dueAt) {
    return {
      kind: "exam" as const,
      dueAt: null,
      confidence: 0.48,
      reason:
        "The post looks like a quiz or exam, but no clear date was found.",
    };
  }

  return {
    kind: "exam" as const,
    dueAt: date.dueAt,
    confidence: date.explicitTime ? 0.9 : 0.74,
    reason: date.explicitTime
      ? "Quiz or exam keyword plus a clear date and time were found."
      : "Quiz or exam keyword plus a date were found. Time defaults to 9:00 AM.",
  };
}
