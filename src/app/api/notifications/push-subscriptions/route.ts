import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10),
  }),
});

const deleteSchema = z.object({
  endpoint: z.string().url().optional(),
});

export async function POST(request: Request) {
  const context = await requireWorkflowContext(
    ["student", "teacher", "admin", "super_admin"],
    { profileRequired: true },
  );
  if (isWorkflowResponse(context)) return context;

  const parsed = subscriptionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || !context.profileId) {
    return NextResponse.json(
      { ok: false, error: "Device notification subscription is invalid." },
      { status: 400 },
    );
  }

  const { error } = await context.supabase.from("push_subscriptions").upsert(
    {
      org_id: context.session.orgId,
      profile_id: context.profileId,
      device_session_id: context.session.deviceSessionId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: request.headers.get("user-agent"),
      enabled: true,
      revoked_at: null,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to save device alerts." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const context = await requireWorkflowContext(
    ["student", "teacher", "admin", "super_admin"],
    { profileRequired: true },
  );
  if (isWorkflowResponse(context)) return context;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})));
  const update = context.supabase
    .from("push_subscriptions")
    .update({
      enabled: false,
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", context.session.orgId)
    .eq("profile_id", context.profileId);

  const result =
    parsed.success && parsed.data.endpoint
      ? await update.eq("endpoint", parsed.data.endpoint)
      : await update.eq("device_session_id", context.session.deviceSessionId);

  if (result.error) {
    return NextResponse.json(
      { ok: false, error: "Unable to disable device alerts." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
