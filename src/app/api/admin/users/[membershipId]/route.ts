import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppSession } from "@/lib/auth/server";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { ensureSessionProfile } from "@/lib/server/workflow-auth";
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

function isMissingRelation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(
      candidate.message?.includes("schema cache") ||
        candidate.message?.includes("does not exist"),
    )
  );
}

async function safeDelete(
  query: PromiseLike<{ error: unknown | null }>,
): Promise<void> {
  const result = await query;
  if (result.error && !isMissingRelation(result.error)) {
    throw result.error;
  }
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

  const actorProfileId = await ensureSessionProfile(supabase, session).catch(
    () => null,
  );

  await supabase.from("audit_logs").insert({
    org_id: session.orgId,
    actor_id: actorProfileId,
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

export async function DELETE(
  _request: Request,
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
  const { data: targetMembership, error: targetError } = await supabase
    .from("memberships")
    .select("id,profile_id,role,profiles!memberships_profile_id_fkey(firebase_uid)")
    .eq("org_id", session.orgId)
    .eq("id", membershipId)
    .maybeSingle();

  if (targetError || !targetMembership) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const actorProfileId = await ensureSessionProfile(supabase, session).catch(
    () => null,
  );
  const targetProfileId = targetMembership.profile_id as string;

  if (actorProfileId && targetProfileId === actorProfileId) {
    return NextResponse.json(
      { error: "You cannot remove your own admin account." },
      { status: 400 },
    );
  }

  await safeDelete(
    supabase
      .from("enrollments")
      .delete()
      .eq("org_id", session.orgId)
      .eq("student_id", targetProfileId),
  );
  await safeDelete(
    supabase
      .from("class_join_requests")
      .delete()
      .eq("org_id", session.orgId)
      .eq("student_id", targetProfileId),
  );
  await safeDelete(
    supabase
      .from("class_teachers")
      .delete()
      .eq("org_id", session.orgId)
      .eq("teacher_id", targetProfileId),
  );
  await safeDelete(
    supabase
      .from("push_subscriptions")
      .delete()
      .eq("org_id", session.orgId)
      .eq("profile_id", targetProfileId),
  );
  await safeDelete(
    supabase
      .from("notifications")
      .delete()
      .eq("org_id", session.orgId)
      .eq("recipient_id", targetProfileId),
  );
  await safeDelete(
    supabase
      .from("device_sessions")
      .delete()
      .eq("org_id", session.orgId)
      .eq("profile_id", targetProfileId),
  );

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("profile_id", targetProfileId)
    .eq("org_id", session.orgId);

  if (error) {
    return NextResponse.json(
      { error: "Unable to remove the user." },
      { status: 500 },
    );
  }

  const profileRelation = Array.isArray(targetMembership.profiles)
    ? targetMembership.profiles[0]
    : targetMembership.profiles;
  const firebaseUid =
    profileRelation && typeof profileRelation.firebase_uid === "string"
      ? profileRelation.firebase_uid
      : null;

  if (firebaseUid && !firebaseUid.startsWith("local-admin:")) {
    await getFirebaseAdminAuth()
      ?.deleteUser(firebaseUid)
      .catch((error) => {
        if (
          typeof error === "object" &&
          error &&
          (error as { code?: string }).code === "auth/user-not-found"
        ) {
          return;
        }
        console.warn(
          "Firebase user removal skipped",
          error instanceof Error ? error.message : "unknown",
        );
      });
  }

  await supabase.from("audit_logs").insert({
    org_id: session.orgId,
    actor_id: actorProfileId,
    action: "admin.user.removed",
    entity: "memberships",
    entity_id: targetMembership.id,
    metadata: {
      profileId: targetProfileId,
      role: targetMembership.role,
      firebaseUserDeleted: Boolean(firebaseUid),
    },
  });

  return NextResponse.json({ ok: true });
}
