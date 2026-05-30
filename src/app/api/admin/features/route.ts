import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";
import { getFeatureFlags } from "@/lib/server/feature-flags";

export const runtime = "nodejs";

const schema = z.object({
  smartLearningEnabled: z.boolean(),
});

export async function GET() {
  const flags = await getFeatureFlags();
  return NextResponse.json({ ok: true, flags });
}

export async function PATCH(request: Request) {
  const context = await requireWorkflowContext(["admin", "super_admin"]);
  if (isWorkflowResponse(context)) return context;

  const body = schema.parse(await request.json());
  const { error } = await context.supabase
    .from("organization_feature_flags")
    .upsert(
      {
        org_id: context.session.orgId,
        smart_learning_enabled: body.smartLearningEnabled,
        updated_by: context.profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    );

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Feature flags table is not ready yet." },
      { status: 503 },
    );
  }

  await writeAuditLog(context, {
    action: "admin.feature_flags.updated",
    entity: "organization_feature_flags",
    entityId: context.session.orgId,
    metadata: { smartLearningEnabled: body.smartLearningEnabled },
  });

  return NextResponse.json({
    ok: true,
    flags: { smartLearningEnabled: body.smartLearningEnabled },
  });
}
