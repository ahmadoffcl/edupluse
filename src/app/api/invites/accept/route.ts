import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sessionCookieName,
  sessionCookieOptions,
  signAppSession,
} from "@/lib/auth/session";
import {
  getFirebaseAdminAuth,
  verifyFirebaseBearerToken,
} from "@/lib/firebase/admin";
import { hashInviteSecret, inviteStatus } from "@/lib/server/invite-tokens";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  idToken: z.string().min(1).optional(),
  token: z.string().trim().optional(),
  code: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).max(128).optional(),
  displayName: z.string().trim().min(1).max(120),
  deviceSessionId: z.string().trim().min(1),
});

function errorCode(error: unknown) {
  return typeof error === "object" && error
    ? (error as { code?: string }).code
    : undefined;
}

function isMissingRelation(error: unknown, relation: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(candidate.message?.includes(relation))
  );
}

function isMissingColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    Boolean(candidate.message?.includes(column))
  );
}

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
      "id,org_id,email,role,expires_at,accepted_at,revoked_at,class_id,max_uses,used_count,created_by,organizations(name),classes(name,teacher_id)",
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

  const auth = getFirebaseAdminAuth();
  let verified: { uid: string; email: string | null; demo?: boolean };

  const inviteEmail =
    typeof invite.email === "string" ? invite.email.toLowerCase() : "";
  const requestedEmail = (body.email ?? inviteEmail).toLowerCase();

  if (body.idToken) {
    verified = await verifyFirebaseBearerToken(
      new Request(request.url, {
        headers: { Authorization: `Bearer ${body.idToken}` },
      }),
    );
  } else {
    if (!auth) {
      return NextResponse.json(
        { ok: false, error: "Account creation is not available yet." },
        { status: 503 },
      );
    }

    if (!requestedEmail || !body.password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required." },
        { status: 400 },
      );
    }

    try {
      const created = await auth.createUser({
        email: requestedEmail,
        password: body.password,
        displayName: body.displayName,
        emailVerified: true,
        disabled: false,
      });
      verified = { uid: created.uid, email: created.email ?? requestedEmail };
    } catch (error) {
      if (
        errorCode(error) === "auth/invalid-password" ||
        errorCode(error) === "auth/weak-password"
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Use a stronger password with at least 8 characters.",
          },
          { status: 400 },
        );
      }

      if (errorCode(error) !== "auth/email-already-exists") {
        throw error;
      }

      const existing = await auth.getUserByEmail(requestedEmail);
      const updated = await auth.updateUser(existing.uid, {
        password: body.password,
        displayName: body.displayName,
        emailVerified: true,
        disabled: false,
      });
      verified = { uid: updated.uid, email: updated.email ?? requestedEmail };
    }
  }

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

  let joinedClassId: string | null = null;
  let joinedClassName: string | null = null;

  if (invite.class_id && invite.role === "student") {
    let enrollment = await supabase.from("enrollments").upsert(
      {
        org_id: invite.org_id,
        class_id: invite.class_id,
        student_id: profile.id,
        status: "enrolled",
        enrolled_at: new Date().toISOString(),
      },
      { onConflict: "class_id,student_id" },
    );

    if (
      enrollment.error &&
      (isMissingColumn(enrollment.error, "status") ||
        isMissingColumn(enrollment.error, "enrolled_at"))
    ) {
      enrollment = await supabase.from("enrollments").upsert(
        {
          org_id: invite.org_id,
          class_id: invite.class_id,
          student_id: profile.id,
        },
        { onConflict: "class_id,student_id" },
      );
    }

    if (enrollment.error) {
      return NextResponse.json(
        { ok: false, error: "Unable to join the invited class." },
        { status: 500 },
      );
    }

    const classRelation = Array.isArray(invite.classes)
      ? invite.classes[0]
      : invite.classes;
    const classRecord =
      classRelation && typeof classRelation === "object"
        ? (classRelation as { name?: string | null })
        : null;
    joinedClassId = invite.class_id as string;
    joinedClassName = classRecord?.name ?? "your class";

    await supabase.from("notifications").insert({
      org_id: invite.org_id,
      recipient_id: profile.id,
      title: "Class joined",
      body: `You joined ${joinedClassName}. Open it to see classwork, posts, and materials.`,
      kind: "class_joined",
      action_url: `/student/classes/${joinedClassId}`,
      metadata: { classId: joinedClassId, inviteId: invite.id },
    });
  }

  let pendingTeacherApproval = false;
  if (invite.class_id && invite.role === "teacher") {
    const { error: classTeacherError } = await supabase.from("class_teachers").upsert(
      {
        org_id: invite.org_id,
        class_id: invite.class_id,
        teacher_id: profile.id,
        role: "co_teacher",
        status: "pending",
        invited_by: invite.created_by ?? null,
        requested_at: new Date().toISOString(),
        approved_at: null,
        approved_by: null,
        rejected_at: null,
        removed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "class_id,teacher_id" },
    );

    if (
      classTeacherError &&
      (isMissingRelation(classTeacherError, "class_teachers") ||
        isMissingColumn(classTeacherError, "status"))
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Teacher approval is being prepared. Ask your class owner to try again after the workspace update.",
        },
        { status: 503 },
      );
    }

    if (classTeacherError) {
      return NextResponse.json(
        { ok: false, error: "Unable to request teacher access." },
        { status: 500 },
      );
    }

    const classRelation = Array.isArray(invite.classes)
      ? invite.classes[0]
      : invite.classes;
    const classRecord =
      classRelation && typeof classRelation === "object"
        ? (classRelation as { name?: string | null; teacher_id?: string | null })
        : null;
    const classOwnerId = classRecord?.teacher_id ?? null;
    const className = classRecord?.name ?? "your class";
    if (classOwnerId) {
      await supabase.from("notifications").insert({
        org_id: invite.org_id,
        recipient_id: classOwnerId,
        title: "Co-teacher waiting for approval",
        body: `${body.displayName} accepted your invite and is waiting to join ${className}.`,
        kind: "teacher_invite",
        action_url: `/teacher/classes/${invite.class_id}?tab=people`,
        metadata: { classId: invite.class_id, teacherId: profile.id },
      });
    }

    pendingTeacherApproval = true;
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
    pendingApproval: pendingTeacherApproval,
    joinedClassId,
    joinedClassName,
  });
  response.cookies.set(sessionCookieName, token, sessionCookieOptions());

  return response;
}
