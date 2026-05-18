import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppSession } from "@/lib/auth/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  role: z.enum(["student", "teacher", "admin"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

function isAdminRole(role: Role) {
  return role === "admin" || role === "super_admin";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ membershipId: string }> },
) {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !isAdminRole(session.role)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Workspace data is unavailable." },
      { status: 503 },
    );
  }

  const { membershipId } = await context.params;
  const body = schema.parse(await request.json());

  if (!body.role && !body.status) {
    return NextResponse.json(
      { error: "No user changes were provided." },
      { status: 400 },
    );
  }

  const { data: targetMembership, error: targetError } = await supabase
    .from("memberships")
    .select("id,profile_id,role,status")
    .eq("org_id", session.orgId)
    .eq("id", membershipId)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json(
      { error: "Unable to load the selected user." },
      { status: 500 },
    );
  }

  if (!targetMembership) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("memberships")
    .update({
      role: body.role ?? targetMembership.role,
      status: body.status ?? targetMembership.status,
    })
    .eq("id", targetMembership.id)
    .eq("org_id", session.orgId);

  if (updateError) {
    return NextResponse.json(
      { error: "Unable to update the user." },
      { status: 500 },
    );
  }

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("firebase_uid", session.uid)
    .maybeSingle();

  await supabase.from("audit_logs").insert({
    org_id: session.orgId,
    actor_id: actorProfile?.id ?? null,
    action: "admin.user.updated",
    entity: "memberships",
    entity_id: targetMembership.id,
    metadata: {
      profileId: targetMembership.profile_id,
      role: body.role ?? targetMembership.role,
      status: body.status ?? targetMembership.status,
    },
  });

  return NextResponse.json({ ok: true });
}
