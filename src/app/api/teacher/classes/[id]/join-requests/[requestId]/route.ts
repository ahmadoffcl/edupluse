import { NextResponse } from "next/server";
import { z } from "zod";
import { isMissingClassJoinRequestTable } from "@/lib/server/class-join-requests";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  decision: z.enum(["approved", "rejected"]),
});

type DbRecord = Record<string, unknown>;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function PATCH(
  request: Request,
  contextParams: { params: Promise<{ id: string; requestId: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { id, requestId } = await contextParams.params;
  const access = await requireClassAccess(context, id);
  if (isWorkflowResponse(access)) return access;
  if (!access) {
    return NextResponse.json(
      { ok: false, error: "Class was not found." },
      { status: 404 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Choose approve or reject." },
      { status: 400 },
    );
  }

  const { data: joinRequest, error: requestError } = await context.supabase
    .from("class_join_requests")
    .select("id,class_id,student_id,status")
    .eq("org_id", context.session.orgId)
    .eq("class_id", id)
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    if (isMissingClassJoinRequestTable(requestError)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Class requests are being prepared. Try again after the workspace update.",
          setupPending: true,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unable to load this request." },
      { status: 500 },
    );
  }

  if (!joinRequest) {
    return NextResponse.json(
      { ok: false, error: "Class request was not found." },
      { status: 404 },
    );
  }

  const row = joinRequest as DbRecord;
  const studentId = stringValue(row.student_id);

  if (parsed.data.decision === "approved") {
    const { error: enrollmentError } = await context.supabase
      .from("enrollments")
      .upsert(
        {
          org_id: context.session.orgId,
          class_id: id,
          student_id: studentId,
        },
        { onConflict: "class_id,student_id" },
      );

    if (enrollmentError) {
      return NextResponse.json(
        { ok: false, error: "Unable to add student to class." },
        { status: 500 },
      );
    }
  }

  const { error: updateError } = await context.supabase
    .from("class_join_requests")
    .update({
      status: parsed.data.decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.profileId,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", context.session.orgId)
    .eq("class_id", id)
    .eq("id", requestId);

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: "Unable to update this request." },
      { status: 500 },
    );
  }

  const approved = parsed.data.decision === "approved";
  const notification = {
    org_id: context.session.orgId,
    recipient_id: studentId,
    title: approved ? "Class request approved" : "Class request declined",
    body: approved
      ? `You have been added to ${access.name}.`
      : `${access.name} is not available for your account right now.`,
    kind: "class_request",
    action_url: approved ? `/student/classes/${id}` : "/student/classes",
    metadata: { classId: id, requestId },
  };
  const { error: notificationError } = await context.supabase
    .from("notifications")
    .insert(notification);
  if (notificationError) {
    const fallbackNotification = {
      org_id: notification.org_id,
      recipient_id: notification.recipient_id,
      title: notification.title,
      body: notification.body,
      kind: notification.kind,
    };
    await context.supabase.from("notifications").insert(fallbackNotification);
  }

  await writeAuditLog(context, {
    action: approved
      ? "teacher.class_join.approved"
      : "teacher.class_join.rejected",
    entity: "class_join_requests",
    entityId: requestId,
    metadata: { classId: id, studentId },
  });

  return NextResponse.json({ ok: true, status: parsed.data.decision });
}
