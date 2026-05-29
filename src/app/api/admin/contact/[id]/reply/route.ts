import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  replyBody: z.string().trim().min(2).max(2000),
  close: z.boolean().optional().default(false),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const context = await requireWorkflowContext(["admin", "super_admin"], {
    profileRequired: false,
  });
  if (isWorkflowResponse(context)) return context;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Write a reply before saving." },
      { status: 400 },
    );
  }

  const { data, error } = await context.supabase
    .from("contact_requests")
    .update({
      reply_body: parsed.data.replyBody,
      status: parsed.data.close ? "closed" : "replied",
      replied_by: context.profileId,
      replied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,email")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "Unable to save contact reply." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "admin.contact.replied",
    entity: "contact_requests",
    entityId: id,
    metadata: {
      email: data.email,
      closed: parsed.data.close,
    },
  });

  return NextResponse.json({ ok: true });
}
