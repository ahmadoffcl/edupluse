import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import { sendProfileNotificationEmails } from "@/lib/email/server";

export const runtime = "nodejs";

const schema = z.object({
  classId: z.string().uuid(),
  recipientId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const context = await requireWorkflowContext(["student"]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  const body = schema.parse(await request.json());
  if (body.recipientId === context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Choose a classmate to message." },
      { status: 400 },
    );
  }

  const { data: enrollments, error: enrollmentError } = await context.supabase
    .from("enrollments")
    .select("student_id,classes(id,name)")
    .eq("org_id", context.session.orgId)
    .eq("class_id", body.classId)
    .in("student_id", [context.profileId, body.recipientId]);

  if (enrollmentError) {
    return NextResponse.json(
      { ok: false, error: "Unable to verify class access." },
      { status: 500 },
    );
  }

  const rows = (enrollments ?? []) as Array<{
    student_id: string;
    classes?:
      | { id?: string; name?: string }
      | Array<{ id?: string; name?: string }>;
  }>;
  const enrolledIds = new Set(rows.map((row) => row.student_id));
  if (
    !enrolledIds.has(context.profileId) ||
    !enrolledIds.has(body.recipientId)
  ) {
    return NextResponse.json(
      { ok: false, error: "You can only message classmates in your class." },
      { status: 403 },
    );
  }

  const classRelation = rows[0]?.classes;
  const classRecord = Array.isArray(classRelation)
    ? classRelation[0]
    : classRelation;
  const className = classRecord?.name ?? "Class";

  const { data: recipient } = await context.supabase
    .from("profiles")
    .select("display_name,username")
    .eq("id", body.recipientId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  const recipientName =
    (recipient?.username
      ? `@${recipient.username}`
      : recipient?.display_name) ?? "Classmate";

  const { data: thread, error: threadError } = await context.supabase
    .from("message_threads")
    .insert({
      org_id: context.session.orgId,
      class_id: body.classId,
      kind: "direct",
      title: `${context.session.displayName} and ${recipientName}`,
      created_by: context.profileId,
    })
    .select("id")
    .single();

  if (threadError) {
    return NextResponse.json(
      { ok: false, error: "Unable to create message thread." },
      { status: 500 },
    );
  }

  const threadId = thread.id as string;
  await context.supabase.from("message_participants").upsert(
    [context.profileId, body.recipientId].map((profileId) => ({
      org_id: context.session.orgId,
      thread_id: threadId,
      profile_id: profileId,
    })),
    { onConflict: "thread_id,profile_id" },
  );

  const { data: message, error: messageError } = await context.supabase
    .from("messages")
    .insert({
      org_id: context.session.orgId,
      thread_id: threadId,
      sender_id: context.profileId,
      body: body.body,
    })
    .select("id,body,created_at")
    .single();

  if (messageError) {
    return NextResponse.json(
      { ok: false, error: "Unable to send message." },
      { status: 500 },
    );
  }

  await sendProfileNotificationEmails({
    supabase: context.supabase,
    profileIds: [body.recipientId],
    subject: `New classmate message in ${className}`,
    eyebrow: "Classmate message",
    title: "New classmate message",
    body: `{name}, ${context.session.displayName} sent you a message: ${body.body}`,
    actionLabel: "Open messages",
    actionUrl: "/student/messages",
  });

  await writeAuditLog(context, {
    action: "student.message.sent",
    entity: "messages",
    entityId: message.id,
    metadata: {
      classId: body.classId,
      recipientId: body.recipientId,
      threadId,
    },
  });

  return NextResponse.json({ ok: true, message });
}
