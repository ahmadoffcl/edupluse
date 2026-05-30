import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TIMETABLE_TIMEZONE,
  type TimetableSession,
} from "@/lib/timetable/types";
import { sendWebPushNotification } from "@/lib/timetable/push";

type DbRecord = Record<string, unknown>;

type TimetableSlotRow = {
  id: string;
  org_id: string;
  class_id: string;
  section_label: string;
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  subject_name: string;
  teacher_name: string | null;
  venue: string | null;
  timezone: string | null;
  effective_from: string | null;
  effective_to: string | null;
  classes?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type EnrollmentRow = {
  class_id: string;
  student_id: string;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function relation(value: unknown) {
  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

function normalizeTime(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 5);
}

function dayNumber(date: Date, timezone = TIMETABLE_TIMEZONE) {
  const weekday = new Intl.DateTimeFormat("en", {
    weekday: "long",
    timeZone: timezone,
  }).format(date);
  return (
    {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
      Sunday: 7,
    } as Record<string, number>
  )[weekday];
}

function localDate(value: Date, timezone = TIMETABLE_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(value);

  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return `${lookup.get("year")}-${lookup.get("month")}-${lookup.get("day")}`;
}

function addDays(ymd: string, days: number, timezone = TIMETABLE_TIMEZONE) {
  const base = localDateTimeToDate(ymd, "12:00", timezone);
  base.setUTCDate(base.getUTCDate() + days);
  return localDate(base, timezone);
}

function localDateTimeToDate(
  ymd: string,
  time: string,
  timezone = TIMETABLE_TIMEZONE,
) {
  if (timezone === "Asia/Karachi") {
    return new Date(`${ymd}T${time}:00+05:00`);
  }

  return new Date(`${ymd}T${time}:00`);
}

function formatLocalTime(value: string, timezone = TIMETABLE_TIMEZONE) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

function notificationBody(slot: TimetableSlotRow, startsAt: string, endsAt: string) {
  const time = `${formatLocalTime(startsAt, slot.timezone ?? TIMETABLE_TIMEZONE)}-${formatLocalTime(
    endsAt,
    slot.timezone ?? TIMETABLE_TIMEZONE,
  )}`;
  return [slot.venue, slot.teacher_name, time].filter(Boolean).join(" - ");
}

function className(slot: TimetableSlotRow) {
  return stringValue(relation(slot.classes)?.name, "Classroom");
}

function occurrenceForDate(slot: TimetableSlotRow, ymd: string) {
  const startTime = normalizeTime(slot.start_time);
  const endTime = normalizeTime(slot.end_time);
  if (!startTime || !endTime) return null;

  const timezone = slot.timezone ?? TIMETABLE_TIMEZONE;
  const startsAt = localDateTimeToDate(ymd, startTime, timezone);
  const endsAt = localDateTimeToDate(ymd, endTime, timezone);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return null;
  }

  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

function slotOccurrences(
  slot: TimetableSlotRow,
  from: Date,
  throughDays: number,
) {
  const timezone = slot.timezone ?? TIMETABLE_TIMEZONE;
  const startDate = localDate(from, timezone);
  const occurrences: Array<{ startsAt: string; endsAt: string }> = [];

  for (let offset = -1; offset <= throughDays; offset += 1) {
    const ymd = addDays(startDate, offset, timezone);
    const dayProbe = localDateTimeToDate(ymd, "12:00", timezone);
    if (dayNumber(dayProbe, timezone) !== slot.day_of_week) continue;
    if (slot.effective_from && ymd < slot.effective_from) continue;
    if (slot.effective_to && ymd > slot.effective_to) continue;

    const occurrence = occurrenceForDate(slot, ymd);
    if (occurrence) occurrences.push(occurrence);
  }

  return occurrences;
}

function startReminder(iso: string) {
  return new Date(new Date(iso).getTime() - 15 * 60 * 1000).toISOString();
}

function dedupeKey(slotId: string, startsAt: string, type: "start" | "end") {
  return `timetable:${slotId}:${startsAt}:${type}`;
}

export async function loadStudentTimetableSessions({
  supabase,
  orgId,
  profileId,
  days = 14,
}: {
  supabase: SupabaseClient;
  orgId: string;
  profileId: string;
  days?: number;
}): Promise<TimetableSession[]> {
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("org_id", orgId)
    .eq("student_id", profileId)
    .limit(1000);

  if (enrollmentError) return [];
  const classIds = ((enrollments ?? []) as EnrollmentRow[])
    .map((row) => row.class_id)
    .filter(Boolean);
  if (classIds.length === 0) return [];

  const { data: slots, error: slotError } = await supabase
    .from("timetable_slots")
    .select(
      "id,org_id,class_id,section_label,day_of_week,start_time,end_time,subject_name,teacher_name,venue,timezone,effective_from,effective_to,classes(name)",
    )
    .eq("org_id", orgId)
    .eq("active", true)
    .eq("review_status", "ready")
    .in("class_id", classIds)
    .limit(1000);

  if (slotError) return [];

  const now = new Date();
  const max = now.getTime() + days * 86_400_000;
  return ((slots ?? []) as unknown as TimetableSlotRow[])
    .flatMap((slot) =>
      slotOccurrences(slot, now, days).map((occurrence) => ({
        id: `${slot.id}-${occurrence.startsAt}`,
        slotId: slot.id,
        classId: slot.class_id,
        className: className(slot),
        sectionLabel: slot.section_label,
        subjectName: slot.subject_name,
        teacherName: slot.teacher_name,
        venue: slot.venue,
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
        startReminderAt: startReminder(occurrence.startsAt),
        endReminderAt: occurrence.endsAt,
        actionUrl: `/student/classes/${slot.class_id}`,
        dedupeStartKey: dedupeKey(slot.id, occurrence.startsAt, "start"),
        dedupeEndKey: dedupeKey(slot.id, occurrence.startsAt, "end"),
      })),
    )
    .filter((session) => {
      const end = new Date(session.endsAt).getTime();
      return end >= now.getTime() - 30 * 60 * 1000 && end <= max;
    })
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
}

export async function materializeTimetableNotifications({
  supabase,
  orgId,
  from = new Date(Date.now() - 10 * 60 * 1000),
  to = new Date(Date.now() + 2 * 60 * 1000),
}: {
  supabase: SupabaseClient;
  orgId?: string;
  from?: Date;
  to?: Date;
}) {
  let query = supabase
    .from("timetable_slots")
    .select(
      "id,org_id,class_id,section_label,day_of_week,start_time,end_time,subject_name,teacher_name,venue,timezone,effective_from,effective_to,classes(name)",
    )
    .eq("active", true)
    .eq("review_status", "ready")
    .not("class_id", "is", null)
    .limit(5000);

  if (orgId) query = query.eq("org_id", orgId);
  const { data: slots, error: slotError } = await query;
  if (slotError) return { inserted: 0, error: slotError.message };

  const slotRows = (slots ?? []) as unknown as TimetableSlotRow[];
  const classIds = Array.from(new Set(slotRows.map((slot) => slot.class_id)));
  if (classIds.length === 0) return { inserted: 0, error: null };

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("class_id,student_id")
    .in("class_id", classIds)
    .limit(10000);
  if (enrollmentError) return { inserted: 0, error: enrollmentError.message };

  const studentsByClass = new Map<string, string[]>();
  for (const row of (enrollments ?? []) as EnrollmentRow[]) {
    const current = studentsByClass.get(row.class_id) ?? [];
    current.push(row.student_id);
    studentsByClass.set(row.class_id, current);
  }

  const rows: DbRecord[] = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();

  for (const slot of slotRows) {
    const recipients = studentsByClass.get(slot.class_id) ?? [];
    if (recipients.length === 0) continue;

    for (const occurrence of slotOccurrences(slot, from, 2)) {
      const reminders = [
        {
          type: "start" as const,
          kind: "class_start_reminder",
          scheduledFor: startReminder(occurrence.startsAt),
          title: `${slot.subject_name} starts in 15 min`,
        },
        {
          type: "end" as const,
          kind: "class_end_reminder",
          scheduledFor: occurrence.endsAt,
          title: `${slot.subject_name} is ending now`,
        },
      ];

      for (const reminder of reminders) {
        const scheduledMs = new Date(reminder.scheduledFor).getTime();
        if (scheduledMs < fromMs || scheduledMs > toMs) continue;

        for (const recipientId of recipients) {
          rows.push({
            org_id: slot.org_id,
            recipient_id: recipientId,
            title: reminder.title,
            body: notificationBody(slot, occurrence.startsAt, occurrence.endsAt),
            kind: reminder.kind,
            action_url: `/student/classes/${slot.class_id}`,
            scheduled_for: reminder.scheduledFor,
            dedupe_key: dedupeKey(slot.id, occurrence.startsAt, reminder.type),
            metadata: {
              slotId: slot.id,
              classId: slot.class_id,
              className: className(slot),
              subjectName: slot.subject_name,
              teacherName: slot.teacher_name,
              venue: slot.venue,
              startsAt: occurrence.startsAt,
              endsAt: occurrence.endsAt,
              reminderType: reminder.type,
            },
          });
        }
      }
    }
  }

  if (rows.length === 0) return { inserted: 0, error: null };

  const { error } = await supabase.from("notifications").upsert(rows, {
    onConflict: "org_id,recipient_id,kind,dedupe_key",
    ignoreDuplicates: true,
  });

  return { inserted: error ? 0 : rows.length, error: error?.message ?? null };
}

export async function dispatchDueTimetableNotifications({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id,org_id,recipient_id,title,body,kind,action_url,dedupe_key")
    .in("kind", ["class_start_reminder", "class_end_reminder"])
    .lte("scheduled_for", new Date().toISOString())
    .is("delivered_at", null)
    .order("scheduled_for", { ascending: true })
    .limit(200);

  if (error) return { delivered: 0, failed: 0, error: error.message };

  let delivered = 0;
  let failed = 0;

  for (const notification of (notifications ?? []) as DbRecord[]) {
    const profileId = stringValue(notification.recipient_id);
    const notificationId = stringValue(notification.id);
    const orgId = stringValue(notification.org_id);

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("profile_id", profileId)
      .eq("enabled", true)
      .is("revoked_at", null)
      .limit(10);

    const subscriptionRows = (subscriptions ?? []) as DbRecord[];
    if (subscriptionRows.length === 0) {
      await supabase.from("notification_delivery_logs").insert({
        org_id: orgId,
        notification_id: notificationId,
        profile_id: profileId,
        channel: "web_push",
        status: "skipped",
        error_message: "No active push subscription.",
      });
    }

    for (const subscription of subscriptionRows) {
      const result = await sendWebPushNotification(
        {
          endpoint: stringValue(subscription.endpoint),
          p256dh: stringValue(subscription.p256dh),
          auth: stringValue(subscription.auth),
        },
        {
          title: stringValue(notification.title, "Class reminder"),
          body: stringValue(notification.body),
          url: stringValue(notification.action_url, "/student/calendar"),
          tag: stringValue(notification.dedupe_key, notificationId),
          kind: stringValue(notification.kind),
        },
      );

      if (result.ok) delivered += 1;
      else failed += 1;

      await supabase.from("notification_delivery_logs").insert({
        org_id: orgId,
        notification_id: notificationId,
        push_subscription_id: stringValue(subscription.id),
        profile_id: profileId,
        channel: "web_push",
        status: result.ok ? "sent" : "failed",
        error_message: result.error,
        delivered_at: result.ok ? new Date().toISOString() : null,
      });

      if (!result.ok && [404, 410].includes(result.statusCode)) {
        await supabase
          .from("push_subscriptions")
          .update({
            enabled: false,
            revoked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", stringValue(subscription.id));
      }
    }

    await supabase
      .from("notifications")
      .update({ delivered_at: new Date().toISOString() })
      .eq("id", notificationId);
  }

  return { delivered, failed, error: null };
}
