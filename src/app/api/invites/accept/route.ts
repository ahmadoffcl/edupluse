import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sessionCookieName,
  sessionCookieOptions,
  signAppSession,
} from "@/lib/auth/session";
import { verifyFirebaseBearerToken } from "@/lib/firebase/admin";
import { hashInviteSecret, inviteStatus } from "@/lib/server/invite-tokens";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  idToken: z.string().min(1),
  token: z.string().trim().optional(),
  code: z.string().trim().optional(),
  displayName: z.string().trim().min(1).max(120),
  deviceSessionId: z.string().trim().min(1),
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

  const verified = await verifyFirebaseBearerToken(
    new Request(request.url, {
      headers: { Authorization: `Bearer ${body.idToken}` },
    }),
  );
  const hash = hashInviteSecret(secret);
  const query = supabase
    .from("invites")
    .select(
      "id,org_id,email,role,expires_at,accepted_at,revoked_at,class_id,max_uses,used_count,organizations(name)",
    );
  const { data: invite, error: inviteError } = body.token
    ? await query.eq("token_hash", hash).maybeSingle()
    : await query.eq("code_hash", hash).maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json(
      { ok: false, error: "Invite was not found." },
      { status: 404 },
    );
  }

  if (inviteStatus(invite) !== "pending") {
    return NextResponse.json(
      { ok: false, error: "Invite is no longer active." },
      { status: 409 },
    );
  }

  const inviteEmail =
    typeof invite.email === "string" ? invite.email.toLowerCase() : "";
  const verifiedEmail = (verified.email ?? "").toLowerCase();
  if (inviteEmail && verifiedEmail && inviteEmail !== verifiedEmail) {
    return NextResponse.json(
      { ok: false, error: "This invite belongs to a different email." },
      { status: 403 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        firebase_uid: verified.uid,
        email: verified.email ?? invite.email,
        display_name: body.displayName,
      },
      { onConflict: "firebase_uid" },
    )
    .select("id,onboarding_completed_at,avatar_url")
    .single();

  if (profileError) {
    return NextResponse.json(
      { ok: false, error: "Unable to create invite profile." },
      { status: 500 },
    );
  }

  const { error: membershipError } = await supabase.from("memberships").upsert(
    {
      org_id: invite.org_id,
      profile_id: profile.id,
      role: invite.role,
      status: "active",
    },
    { onConflict: "org_id,profile_id,role" },
  );

  if (membershipError) {
    return NextResponse.json(
      { ok: false, error: "Unable to join institution." },
      { status: 500 },
    );
  }

  if (invite.class_id && invite.role === "student") {
    await supabase.from("enrollments").upsert(
      {
        org_id: invite.org_id,
        class_id: invite.class_id,
        student_id: profile.id,
      },
      { onConflict: "class_id,student_id" },
    );
  }

  const usedCount = Number(invite.used_count ?? 0) + 1;
  await supabase
    .from("invites")
    .update({
      used_count: usedCount,
      accepted_at:
        usedCount >= Number(invite.max_uses ?? 1)
          ? new Date().toISOString()
          : invite.accepted_at,
    })
    .eq("id", invite.id);

  await supabase.from("device_sessions").upsert(
    {
      org_id: invite.org_id,
      profile_id: profile.id,
      device_id: body.deviceSessionId,
      user_agent: request.headers.get("user-agent"),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "profile_id,device_id" },
  );

  const organization = Array.isArray(invite.organizations)
    ? invite.organizations[0]
    : invite.organizations;
  const role = invite.role as Role;
  const token = await signAppSession({
    uid: verified.uid,
    email: verified.email ?? invite.email,
    displayName: body.displayName,
    role,
    orgId: invite.org_id,
    orgName: organization?.name ?? "EduPulse",
    deviceSessionId: body.deviceSessionId,
    photoURL:
      typeof profile.avatar_url === "string" ? profile.avatar_url : null,
    onboardingCompleted: Boolean(profile.onboarding_completed_at),
  });

  const response = NextResponse.json({
    ok: true,
    role,
    orgId: invite.org_id,
    orgName: organization?.name ?? "EduPulse",
    photoURL:
      typeof profile.avatar_url === "string" ? profile.avatar_url : null,
    onboardingCompleted: Boolean(profile.onboarding_completed_at),
  });
  response.cookies.set(sessionCookieName, token, sessionCookieOptions());

  return response;
}
