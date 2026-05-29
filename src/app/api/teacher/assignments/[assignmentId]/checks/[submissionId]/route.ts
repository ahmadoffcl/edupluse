import { NextResponse } from "next/server";
import {
  createIntegrityReport,
  getIntegrityReport,
} from "@/lib/server/integrity-report";
import {
  isWorkflowResponse,
  requireAssignmentAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ assignmentId: string; submissionId: string }>;
};

async function checkedContext(params: Params["params"]) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { assignmentId, submissionId } = await params;
  const assignment = await requireAssignmentAccess(context, assignmentId);
  if (isWorkflowResponse(assignment)) return assignment;

  return { context, assignmentId, submissionId };
}

export async function GET(_request: Request, contextParams: Params) {
  const resolved = await checkedContext(contextParams.params);
  if (isWorkflowResponse(resolved)) return resolved;

  try {
    const report = await getIntegrityReport(
      resolved.context,
      resolved.assignmentId,
      resolved.submissionId,
    );
    return NextResponse.json({ ok: true, data: report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load checks report.",
      },
      { status: 404 },
    );
  }
}

export async function POST(_request: Request, contextParams: Params) {
  const resolved = await checkedContext(contextParams.params);
  if (isWorkflowResponse(resolved)) return resolved;

  try {
    const report = await createIntegrityReport(
      resolved.context,
      resolved.assignmentId,
      resolved.submissionId,
    );

    await writeAuditLog(resolved.context, {
      action: "teacher.integrity_report.generated",
      entity: "submission_integrity_reports",
      entityId: report.report?.id ?? null,
      metadata: {
        assignmentId: resolved.assignmentId,
        submissionId: resolved.submissionId,
      },
    });

    return NextResponse.json({ ok: true, data: report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate checks report.",
      },
      { status: 500 },
    );
  }
}
