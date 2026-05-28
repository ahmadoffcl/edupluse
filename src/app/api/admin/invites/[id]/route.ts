import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["revoke"]),
});

export async function PATCH(
  request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext(["admin", "super_admin"], {
    profileRequired: false,
  });
  if (isWorkflowResponse(context)) return context;

  const { id } = await contextParams.params;
  const body = schema.parse(await request.json());

  if (body.action !== "revoke") {
    return NextResponse.json(
      { ok: false, error: "Unsupported invite action." },
      { status: 400 },
    );
  }

  const { error } = await context.supabase
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", context.session.orgId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to revoke invite." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "admin.invite.revoked",
    entity: "invites",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
