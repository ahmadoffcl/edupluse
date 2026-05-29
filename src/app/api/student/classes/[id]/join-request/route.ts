import { NextResponse } from "next/server";
import { requestClassJoins } from "@/lib/server/class-join-requests";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext(["student"]);
  if (isWorkflowResponse(context)) return context;
  if (!context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Profile is not ready yet." },
      { status: 404 },
    );
  }

  const { id } = await contextParams.params;
  const result = await requestClassJoins({
    supabase: context.supabase,
    orgId: context.session.orgId,
    studentId: context.profileId,
    studentName: context.session.displayName,
    classIds: [id],
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.setupPending
          ? "Class requests are being prepared. Try again after the workspace update."
          : (result.error ?? "Unable to request this class."),
        setupPending: result.setupPending,
      },
      { status: result.setupPending ? 503 : 400 },
    );
  }

  await writeAuditLog(context, {
    action: "student.class_join.requested",
    entity: "class_join_requests",
    entityId: id,
    metadata: { classId: id },
  });

  return NextResponse.json({ ok: true, created: result.created });
}
