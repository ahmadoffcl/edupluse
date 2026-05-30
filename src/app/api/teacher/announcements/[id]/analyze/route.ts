import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireAnnouncementAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import { materializeAnnouncementLearningTask } from "@/lib/server/post-learning-analysis";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await contextParams.params;
  const access = await requireAnnouncementAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const { data: announcement, error } = await context.supabase
    .from("announcements")
    .select("id,class_id,title,body")
    .eq("id", id)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (error || !announcement) {
    return NextResponse.json(
      { ok: false, error: "Unable to analyze this post." },
      { status: 500 },
    );
  }

  const result = await materializeAnnouncementLearningTask({
    context,
    announcementId: id,
    classId:
      typeof announcement.class_id === "string" ? announcement.class_id : null,
    title: typeof announcement.title === "string" ? announcement.title : "",
    body: typeof announcement.body === "string" ? announcement.body : "",
  });

  await writeAuditLog(context, {
    action: "teacher.announcement.analyzed",
    entity: "announcements",
    entityId: id,
    metadata: result,
  });

  return NextResponse.json({ ok: true, ...result });
}
