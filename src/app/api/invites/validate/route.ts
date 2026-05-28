import { NextResponse } from "next/server";
import { z } from "zod";
import { hashInviteSecret, inviteStatus } from "@/lib/server/invite-tokens";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().trim().optional(),
  code: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Workspace data is unavailable." },
      { status: 503 },
    );
  }

  const body = schema.parse(await request.json());
  const secret = body.token || body.code;

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Invite token or code is required." },
      { status: 400 },
    );
  }

  const hash = hashInviteSecret(secret);
  const query = supabase
    .from("invites")
    .select(
      "id,email,role,expires_at,accepted_at,revoked_at,department,section,personal_message,max_uses,used_count,organizations(name),classes(name)",
    );
  const { data, error } = body.token
    ? await query.eq("token_hash", hash).maybeSingle()
    : await query.eq("code_hash", hash).maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "Invite was not found." },
      { status: 404 },
    );
  }

  const invite = data as Record<string, unknown>;
  const organization = Array.isArray(invite.organizations)
    ? (invite.organizations[0] as { name?: string } | undefined)
    : (invite.organizations as { name?: string } | undefined);
  const classRecord = Array.isArray(invite.classes)
    ? (invite.classes[0] as { name?: string } | undefined)
    : (invite.classes as { name?: string } | undefined);
  const status = inviteStatus({
    accepted_at:
      typeof invite.accepted_at === "string" ? invite.accepted_at : null,
    expires_at:
      typeof invite.expires_at === "string"
        ? invite.expires_at
        : new Date().toISOString(),
    revoked_at:
      typeof invite.revoked_at === "string" ? invite.revoked_at : null,
    used_count: typeof invite.used_count === "number" ? invite.used_count : 0,
    max_uses: typeof invite.max_uses === "number" ? invite.max_uses : 1,
  });

  return NextResponse.json({
    ok: status === "pending",
    status,
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expires_at,
      department: invite.department,
      section: invite.section,
      message: invite.personal_message,
      orgName: organization?.name ?? "EduPulse",
      className: classRecord?.name ?? null,
    },
  });
}
