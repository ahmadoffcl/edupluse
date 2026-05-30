import "server-only";
import { analyzeLearningPost } from "@/lib/learning/item-classifier";
import type { WorkflowContext } from "@/lib/server/workflow-auth";

type DbRecord = Record<string, unknown>;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  }).format(new Date(value));
}

export async function materializeAnnouncementLearningTask({
  context,
  announcementId,
  classId,
  title,
  body,
}: {
  context: WorkflowContext;
  announcementId: string;
  classId: string | null;
  title: string;
  body: string;
}) {
  if (!classId) {
    return {
      created: false,
      message: "Only class posts can become student upcoming tasks.",
    };
  }

  const analysis = analyzeLearningPost({ title, body });
  if (analysis.kind !== "exam") {
    return { created: false, message: analysis.reason };
  }
  if (!analysis.dueAt) {
    return { created: false, message: analysis.reason };
  }

  const eventTitle = title.match(/\b(quiz|test|exam|viva|assessment)\b/i)
    ? title
    : `Quiz: ${title}`;
  const endsAt = new Date(
    new Date(analysis.dueAt).getTime() + 60 * 60 * 1000,
  ).toISOString();

  const { data: existingEvent } = await context.supabase
    .from("calendar_events")
    .select("id")
    .eq("org_id", context.session.orgId)
    .eq("class_id", classId)
    .eq("kind", "exam")
    .eq("title", eventTitle)
    .eq("starts_at", analysis.dueAt)
    .maybeSingle();

  let eventId = stringValue((existingEvent as DbRecord | null)?.id);
  if (!eventId) {
    const { data: event, error: eventError } = await context.supabase
      .from("calendar_events")
      .insert({
        org_id: context.session.orgId,
        class_id: classId,
        owner_id: context.profileId,
        title: eventTitle,
        kind: "exam",
        starts_at: analysis.dueAt,
        ends_at: endsAt,
      })
      .select("id")
      .single();

    if (eventError || !event) {
      return {
        created: false,
        message:
          "The post was recognized, but the upcoming task could not be saved.",
      };
    }
    eventId = stringValue((event as DbRecord).id);
  }

  const { data: enrollments } = await context.supabase
    .from("enrollments")
    .select("student_id")
    .eq("org_id", context.session.orgId)
    .eq("class_id", classId)
    .limit(2000);
  const recipients = ((enrollments ?? []) as DbRecord[])
    .map((row) => stringValue(row.student_id))
    .filter(Boolean);

  if (recipients.length > 0) {
    const rows = recipients.map((recipientId) => ({
      org_id: context.session.orgId,
      recipient_id: recipientId,
      title: "Quiz added to upcoming",
      body: `${eventTitle} is scheduled for ${formatDateTime(analysis.dueAt)}.`,
      kind: "exam",
      action_url: "/student/upcoming",
      dedupe_key: `announcement:${announcementId}:exam:${analysis.dueAt}`,
      metadata: {
        announcementId,
        classId,
        eventId,
        dueAt: analysis.dueAt,
        reason: analysis.reason,
        confidence: analysis.confidence,
      },
    }));

    const { error } = await context.supabase
      .from("notifications")
      .upsert(rows, {
        onConflict: "org_id,recipient_id,kind,dedupe_key",
        ignoreDuplicates: true,
      });

    if (error) {
      await context.supabase.from("notifications").insert(
        rows.map((row) => ({
          org_id: row.org_id,
          recipient_id: row.recipient_id,
          title: row.title,
          body: row.body,
          kind: row.kind,
        })),
      );
    }
  }

  return {
    created: true,
    message: `Upcoming quiz task created for ${recipients.length} student${
      recipients.length === 1 ? "" : "s"
    }.`,
    eventId,
    dueAt: analysis.dueAt,
    recipients: recipients.length,
  };
}
