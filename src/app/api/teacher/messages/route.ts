import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import { sendProfileNotificationEmails } from "@/lib/email/server";

export const runtime = "nodejs";

const schema = z.object({
  classId: z.string().uuid(),
  recipientId: z.string().uuid().optional().nullable(),
  body: z.string().trim().min(1).max(4000),
  title: z.string().trim().max(160).optional().nullable(),
});

export async function POST(request: Request) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const body = schema.parse(await request.json());
  const classAccess = await requireClassAccess(context, body.classId);
  if (isWorkflowResponse(classAccess)) return classAccess;
  if (!classAccess) {
    return NextResponse.json(
      { ok: false, error: "Class was not found." },
      { status: 404 },
    );
  }

  if (body.recipientId) {
    const { data: enrollment, error: enrollmentError } = await context.supabase
      .from("enrollments")
      .select("student_id")
      .eq("org_id", context.session.orgId)
      .eq("class_id", body.classId)
      .eq("student_id", body.recipientId)
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        { ok: false, error: "Student is not enrolled in this class." },
        { status: 403 },
      );
    }
  }

  const { data: existingThread, error: existingThreadError } = body.recipientId
    ? { data: null, error: null }
    : await context.supabase
        .from("message_threads")
        .select("id")
        .eq("org_id", context.session.orgId)
        .eq("class_id", body.classId)
        .eq("kind", "class_channel")
        .maybeSingle();

  if (existingThreadError) {
    return NextResponse.json(
      { ok: false, error: "Unable to load message thread." },
      { status: 500 },
    );
  }

  let threadId = existingThread?.id as string | undefined;
  if (!threadId) {
    const { data: thread, error: threadError } = await context.supabase
      .from("message_threads")
      .insert({
        org_id: context.session.orgId,
        class_id: body.classId,
        kind: body.recipientId ? "direct" : "class_channel",
        title: body.title || classAccess.name,
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

    threadId = thread.id as string;
  }

  const { data: enrollments } = body.recipientId
    ? { data: [] }
    : await context.supabase
        .from("enrollments")
        .select("student_id")
        .eq("org_id", context.session.orgId)
        .eq("class_id", body.classId);
  const participantIds = Array.from(
    new Set([
      context.profileId,
      body.recipientId,
      ...((enrollments ?? []) as Array<{ student_id: string }>).map(
        (row) => row.student_id,
      ),
    ]),
  ).filter(Boolean) as string[];

  if (participantIds.length) {
    await context.supabase.from("message_participants").upsert(
      participantIds.map((profileId) => ({
        org_id: context.session.orgId,
        thread_id: threadId,
        profile_id: profileId,
      })),
      { onConflict: "thread_id,profile_id" },
    );
  }

  const { data: message, error } = await context.supabase
    .from("messages")
    .insert({
      org_id: context.session.orgId,
      thread_id: threadId,
      sender_id: context.profileId,
      body: body.body,
    })
    .select("id,body,created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to send message." },
      { status: 500 },
    );
  }

  await sendProfileNotificationEmails({
    supabase: context.supabase,
    profileIds: participantIds.filter((id) => id !== context.profileId),
    subject: body.title || `New message in ${classAccess.name}`,
    eyebrow: "Class message",
    title: body.title || "New teacher message",
    body: `{name}, ${context.session.displayName} sent a new message: ${body.body}`,
    actionLabel: "Open messages",
    actionUrl: "/student/messages",
  });

  await writeAuditLog(context, {
    action: "teacher.message.sent",
    entity: "messages",
    entityId: message.id,
    metadata: {
      classId: body.classId,
      threadId,
      recipientId: body.recipientId,
    },
  });

  return NextResponse.json({ ok: true, message });
}
