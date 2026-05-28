import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireSubmissionAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  score: z.coerce.number().min(0).max(1000),
  feedback: z.string().trim().max(3000).optional().nullable(),
  status: z.enum(["graded", "returned"]).default("graded"),
});

export async function PATCH(
  request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await contextParams.params;
  const submissionAccess = await requireSubmissionAccess(context, id);
  if (isWorkflowResponse(submissionAccess)) return submissionAccess;

  const body = schema.parse(await request.json());
  const { data, error } = await context.supabase
    .from("submissions")
    .update({
      score: body.score,
      feedback: body.feedback || null,
      status: body.status,
      graded_at: new Date().toISOString(),
    })
    .eq("id", submissionAccess.id)
    .eq("org_id", context.session.orgId)
    .select("id,status,score,feedback,graded_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to save grade." },
      { status: 500 },
    );
  }

  const { error: xpError } = await context.supabase
    .from("gamification_events")
    .insert({
      org_id: context.session.orgId,
      profile_id: submissionAccess.studentId,
      action: "assignment_graded",
      xp: Math.max(10, Math.min(200, Math.round(body.score))),
      metadata: {
        assignmentId: submissionAccess.assignmentId,
        submissionId: submissionAccess.id,
      },
    });

  if (xpError) {
    console.warn("Grade XP event skipped", xpError.code);
  }

  const { error: notificationError } = await context.supabase
    .from("notifications")
    .insert({
      org_id: context.session.orgId,
      recipient_id: submissionAccess.studentId,
      title: "Assignment returned",
      body: `${submissionAccess.assignment?.title ?? "Your assignment"} has new feedback.`,
      kind: "grade",
    });

  if (notificationError) {
    console.warn("Grade notification skipped", notificationError.code);
  }

  await writeAuditLog(context, {
    action: "teacher.submission.graded",
    entity: "submissions",
    entityId: submissionAccess.id,
    metadata: {
      assignmentId: submissionAccess.assignmentId,
      score: body.score,
      status: body.status,
    },
  });

  return NextResponse.json({ ok: true, submission: data });
}
