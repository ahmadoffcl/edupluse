import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  classId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(2).max(4000),
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
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

  const { data, error } = await context.supabase
    .from("announcements")
    .insert({
      org_id: context.session.orgId,
      class_id: body.classId || null,
      created_by: context.profileId,
      title: body.title,
      body: body.body,
      published_at: new Date().toISOString(),
    })
    .select("id,title")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to publish announcement." },
      { status: 500 },
    );
  }

  if (body.classId) {
    const { data: enrollments } = await context.supabase
      .from("enrollments")
      .select("student_id")
      .eq("org_id", context.session.orgId)
      .eq("class_id", body.classId);

    const notifications = (
      (enrollments ?? []) as Array<{ student_id: string }>
    ).map((enrollment) => ({
      org_id: context.session.orgId,
      recipient_id: enrollment.student_id,
      title: body.title,
      body: body.body,
      kind: "announcement",
    }));

    if (notifications.length) {
      const { error: notificationError } = await context.supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.warn(
          "Announcement notifications skipped",
          notificationError.code,
        );
      }
    }
  }

  await writeAuditLog(context, {
    action: "teacher.announcement.published",
    entity: "announcements",
    entityId: data.id,
    metadata: { classId: body.classId || null },
  });

  return NextResponse.json({ ok: true, announcement: data });
}
