import { NextResponse } from "next/server";
import { z } from "zod";
import { demoOrg, demoUsers } from "@/lib/mock-data";
import { isDemoModeEnabled } from "@/lib/config";
import {
  sessionCookieName,
  sessionCookieOptions,
  signAppSession,
} from "@/lib/auth/session";
import { verifyFirebaseBearerToken } from "@/lib/firebase/admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const bootstrapOrg = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "EduPulse Academy Network",
  slug: "edupulse-academy-network",
};
const bootstrapRoles: Role[] = ["student", "teacher", "admin", "super_admin"];
type SupabaseServiceClient = NonNullable<
  ReturnType<typeof getSupabaseServiceClient>
>;
type MembershipResolution = {
  role: Role;
  orgId: string;
  orgName: string;
  profileId: string | null;
  onboardingCompleted: boolean;
};

const schema = z.object({
  idToken: z.string().optional().nullable(),
  role: z.enum(["student", "teacher", "admin", "super_admin"]).optional(),
  displayName: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  orgId: z.string().min(1).default(demoOrg.id),
  orgName: z.string().min(1).default(demoOrg.name),
  deviceSessionId: z.string().min(1),
  allowSelfSignup: z.boolean().optional().default(false),
});

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "PGRST205" ||
    candidate.code === "42P01" ||
    candidate.message?.includes("Could not find the table") ||
    candidate.message?.includes("does not exist")
  );
}

function schemaInstallError() {
  return new Error("Workspace setup is not complete yet.");
}

function firstUserBootstrapEnabled() {
  return (
    process.env.EDUPULSE_ENABLE_FIRST_USER_BOOTSTRAP === "true" ||
    process.env.LUMINA_ENABLE_FIRST_USER_BOOTSTRAP === "true"
  );
}

function selfSignupEnabled() {
  return process.env.EDUPULSE_ALLOW_SELF_SIGNUP === "true";
}

async function ensureOrganization(supabase: SupabaseServiceClient) {
  const { error } = await supabase.from("organizations").upsert(
    {
      id: bootstrapOrg.id,
      name: bootstrapOrg.name,
      slug: bootstrapOrg.slug,
      tenant_type: "hybrid_institute",
      status: "active",
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}

async function ensureStudentMembership({
  supabase,
  uid,
  email,
  displayName,
}: {
  supabase: SupabaseServiceClient;
  uid: string;
  email: string | null;
  displayName: string;
}): Promise<MembershipResolution> {
  await ensureOrganization(supabase);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        firebase_uid: uid,
        email,
        display_name: displayName,
      },
      { onConflict: "firebase_uid" },
    )
    .select("id,onboarding_completed_at")
    .single();

  if (profileError) throw profileError;

  const { error: membershipError } = await supabase.from("memberships").upsert(
    {
      org_id: bootstrapOrg.id,
      profile_id: profile.id,
      role: "student",
      status: "active",
    },
    { onConflict: "org_id,profile_id,role" },
  );

  if (membershipError) throw membershipError;

  return {
    role: "student" as Role,
    orgId: bootstrapOrg.id,
    orgName: bootstrapOrg.name,
    profileId: profile.id as string,
    onboardingCompleted: Boolean(profile.onboarding_completed_at),
  };
}

async function maybeBootstrapFirstUser({
  supabase,
  uid,
  email,
  displayName,
  requestedRole,
}: {
  supabase: SupabaseServiceClient;
  uid: string;
  email: string | null;
  displayName: string;
  requestedRole?: Role;
}): Promise<MembershipResolution | null> {
  if (!firstUserBootstrapEnabled()) return null;

  const { count, error: countError } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true });

  if (countError) {
    if (isMissingSchemaError(countError)) throw schemaInstallError();
    throw countError;
  }

  if (count && count > 0) return null;

  await ensureOrganization(supabase);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        firebase_uid: uid,
        email,
        display_name: displayName,
      },
      { onConflict: "firebase_uid" },
    )
    .select("id,onboarding_completed_at")
    .single();

  if (profileError) throw profileError;

  const { error: membershipError } = await supabase.from("memberships").upsert(
    bootstrapRoles.map((role) => ({
      org_id: bootstrapOrg.id,
      profile_id: profile.id,
      role,
      status: "active",
    })),
    { onConflict: "org_id,profile_id,role" },
  );

  if (membershipError) throw membershipError;

  return {
    role: requestedRole ?? "admin",
    orgId: bootstrapOrg.id,
    orgName: bootstrapOrg.name,
    profileId: profile.id as string,
    onboardingCompleted: Boolean(profile.onboarding_completed_at),
  };
}

async function resolveMembership({
  uid,
  requestedRole,
  email,
  displayName,
  allowSelfSignup,
}: {
  uid: string;
  requestedRole?: Role;
  email: string | null;
  displayName: string;
  allowSelfSignup: boolean;
}): Promise<MembershipResolution> {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    if (isDemoModeEnabled()) {
      return {
        role: requestedRole ?? "student",
        orgId: demoOrg.id,
        orgName: demoOrg.name,
        profileId: null,
        onboardingCompleted: false,
      };
    }

    throw new Error("Workspace access is not configured.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,onboarding_completed_at")
    .eq("firebase_uid", uid)
    .maybeSingle();

  if (profileError) {
    if (isMissingSchemaError(profileError)) throw schemaInstallError();
    throw profileError;
  }

  if (!profile) {
    if (allowSelfSignup && selfSignupEnabled() && !requestedRole) {
      return ensureStudentMembership({
        supabase,
        uid,
        email,
        displayName,
      });
    }

    const bootstrapped = await maybeBootstrapFirstUser({
      supabase,
      uid,
      email,
      displayName,
      requestedRole,
    });

    if (bootstrapped) return bootstrapped;

    throw new Error(
      "No active EduPulse profile exists for this account. Ask an admin to invite this account.",
    );
  }

  const membershipQuery = supabase
    .from("memberships")
    .select("org_id, role, status, organizations(name)")
    .eq("profile_id", profile.id)
    .eq("status", "active");

  const membershipResult = requestedRole
    ? await membershipQuery.eq("role", requestedRole).maybeSingle()
    : await membershipQuery;
  const membershipError = membershipResult.error;
  const membership = Array.isArray(membershipResult.data)
    ? membershipResult.data.sort(
        (a, b) =>
          bootstrapRoles.indexOf(b.role as Role) -
          bootstrapRoles.indexOf(a.role as Role),
      )[0]
    : membershipResult.data;

  if (membershipError) {
    if (isMissingSchemaError(membershipError)) throw schemaInstallError();
    throw membershipError;
  }

  if (!membership) {
    if (allowSelfSignup && selfSignupEnabled() && !requestedRole) {
      return ensureStudentMembership({
        supabase,
        uid,
        email,
        displayName,
      });
    }

    const bootstrapped = await maybeBootstrapFirstUser({
      supabase,
      uid,
      email,
      displayName,
      requestedRole,
    });

    if (bootstrapped) return bootstrapped;

    throw new Error("No active dashboard role is assigned to this account.");
  }

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  return {
    role: membership.role as Role,
    orgId: membership.org_id as string,
    orgName: organization?.name ?? demoOrg.name,
    profileId: profile.id as string,
    onboardingCompleted: Boolean(profile.onboarding_completed_at),
  };
}

async function recordDeviceSession({
  supabase,
  membership,
  deviceSessionId,
  request,
}: {
  supabase: SupabaseServiceClient | null;
  membership: MembershipResolution;
  deviceSessionId: string;
  request: Request;
}) {
  if (!supabase || !membership.profileId) return;

  await supabase.from("device_sessions").upsert(
    {
      org_id: membership.orgId,
      profile_id: membership.profileId,
      device_id: deviceSessionId,
      user_agent: request.headers.get("user-agent"),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "profile_id,device_id" },
  );
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const verified =
      !body.idToken && isDemoModeEnabled()
        ? {
            uid: demoUsers[body.role ?? "student"].uid,
            email: demoUsers[body.role ?? "student"].email,
            demo: true,
          }
        : await verifyFirebaseBearerToken(
            new Request(request.url, {
              headers: body.idToken
                ? { Authorization: `Bearer ${body.idToken}` }
                : {},
            }),
          );
    const membership = await resolveMembership({
      uid: verified.uid,
      requestedRole: body.role,
      email: body.email ?? verified.email ?? null,
      displayName: body.displayName,
      allowSelfSignup: body.allowSelfSignup,
    });
    await recordDeviceSession({
      supabase: getSupabaseServiceClient(),
      membership,
      deviceSessionId: body.deviceSessionId,
      request,
    });

    const token = await signAppSession({
      uid: verified.uid,
      email: body.email ?? verified.email ?? null,
      displayName: body.displayName,
      role: membership.role,
      orgId: membership.orgId,
      orgName: membership.orgName,
      deviceSessionId: body.deviceSessionId,
    });

    const response = NextResponse.json({
      ok: true,
      role: membership.role,
      orgId: membership.orgId,
      orgName: membership.orgName,
      onboardingCompleted: membership.onboardingCompleted,
    });
    response.cookies.set(sessionCookieName, token, sessionCookieOptions());

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create app session.",
      },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
