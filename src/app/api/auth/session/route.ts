import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppSession } from "@/lib/auth/server";
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
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  setupPending?: boolean;
};
type ProfileLookup = {
  id: string;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
};
type MembershipRow = {
  org_id: string;
  role: Role | string;
  organizations?: { name?: string | null } | Array<{ name?: string | null }>;
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

function isMissingProfileColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    Boolean(
      candidate.message?.includes(column) &&
      (candidate.message.includes("schema cache") ||
        candidate.message.includes("does not exist")),
    )
  );
}

async function selectProfileByUid(
  supabase: SupabaseServiceClient,
  uid: string,
): Promise<{ profile: ProfileLookup | null; error: unknown | null }> {
  const result = await supabase
    .from("profiles")
    .select("id,onboarding_completed_at,avatar_url")
    .eq("firebase_uid", uid)
    .maybeSingle();

  if (!result.error) {
    return {
      profile: result.data
        ? {
            id: result.data.id as string,
            avatarUrl:
              typeof result.data.avatar_url === "string"
                ? result.data.avatar_url
                : null,
            onboardingCompleted: Boolean(result.data.onboarding_completed_at),
          }
        : null,
      error: null,
    };
  }

  if (!isMissingProfileColumn(result.error, "onboarding_completed_at")) {
    return { profile: null, error: result.error };
  }

  let fallback = await supabase
    .from("profiles")
    .select("id,avatar_url")
    .eq("firebase_uid", uid)
    .maybeSingle();

  if (fallback.error && isMissingProfileColumn(fallback.error, "avatar_url")) {
    fallback = await supabase
      .from("profiles")
      .select("id")
      .eq("firebase_uid", uid)
      .maybeSingle();
  }

  if (fallback.error) {
    return { profile: null, error: fallback.error };
  }

  return {
    profile: fallback.data
      ? {
          id: fallback.data.id as string,
          avatarUrl:
            "avatar_url" in fallback.data &&
            typeof fallback.data.avatar_url === "string"
              ? fallback.data.avatar_url
              : null,
          onboardingCompleted: true,
        }
      : null,
    error: null,
  };
}

async function upsertBasicProfile({
  supabase,
  uid,
  email,
  displayName,
}: {
  supabase: SupabaseServiceClient;
  uid: string;
  email: string | null;
  displayName: string;
}) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        firebase_uid: uid,
        email,
        display_name: displayName,
      },
      { onConflict: "firebase_uid" },
    )
    .select("id")
    .single();

  if (error) throw error;

  return data.id as string;
}

function provisionalMembership(requestedRole?: Role): MembershipResolution {
  return {
    role: requestedRole ?? "student",
    orgId: bootstrapOrg.id,
    orgName: bootstrapOrg.name,
    profileId: null,
    avatarUrl: null,
    onboardingCompleted: false,
    setupPending: true,
  };
}

function firstUserBootstrapEnabled() {
  return (
    process.env.EDUPULSE_ENABLE_FIRST_USER_BOOTSTRAP === "true" ||
    process.env.LUMINA_ENABLE_FIRST_USER_BOOTSTRAP === "true"
  );
}

function selfSignupEnabled() {
  return process.env.EDUPULSE_ALLOW_SELF_SIGNUP !== "false";
}

async function ensureOrganization(supabase: SupabaseServiceClient) {
  let result = await supabase.from("organizations").upsert(
    {
      id: bootstrapOrg.id,
      name: bootstrapOrg.name,
      slug: bootstrapOrg.slug,
      tenant_type: "hybrid_institute",
      status: "active",
    },
    { onConflict: "id" },
  );

  if (
    result.error &&
    (isMissingProfileColumn(result.error, "tenant_type") ||
      isMissingProfileColumn(result.error, "status") ||
      isMissingProfileColumn(result.error, "slug"))
  ) {
    result = await supabase.from("organizations").upsert(
      {
        id: bootstrapOrg.id,
        name: bootstrapOrg.name,
      },
      { onConflict: "id" },
    );
  }

  if (result.error) throw result.error;
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

  const profileId = await upsertBasicProfile({
    supabase,
    uid,
    email,
    displayName,
  });

  const { error: membershipError } = await supabase.from("memberships").upsert(
    {
      org_id: bootstrapOrg.id,
      profile_id: profileId,
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
    profileId,
    avatarUrl: null,
    onboardingCompleted: false,
  };
}

async function tryEnsureStudentMembership(
  input: Parameters<typeof ensureStudentMembership>[0],
): Promise<MembershipResolution> {
  try {
    return await ensureStudentMembership(input);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return provisionalMembership("student");
    }

    throw error;
  }
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
    if (isMissingSchemaError(countError)) {
      return provisionalMembership(requestedRole);
    }
    throw countError;
  }

  if (count && count > 0) return null;

  await ensureOrganization(supabase);

  const profileId = await upsertBasicProfile({
    supabase,
    uid,
    email,
    displayName,
  });

  const { error: membershipError } = await supabase.from("memberships").upsert(
    bootstrapRoles.map((role) => ({
      org_id: bootstrapOrg.id,
      profile_id: profileId,
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
    profileId,
    avatarUrl: null,
    onboardingCompleted: true,
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
    if (allowSelfSignup || isDemoModeEnabled()) {
      return provisionalMembership(requestedRole);
    }

    throw new Error("Workspace access is not configured.");
  }

  const { profile, error: profileError } = await selectProfileByUid(
    supabase,
    uid,
  );

  if (profileError) {
    if (isMissingSchemaError(profileError) && allowSelfSignup) {
      return provisionalMembership(requestedRole);
    }
    throw profileError;
  }

  if (!profile) {
    if (allowSelfSignup && selfSignupEnabled() && !requestedRole) {
      return tryEnsureStudentMembership({
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

  const membershipQuery = (select: string) => {
    const query = supabase
      .from("memberships")
      .select(select)
      .eq("profile_id", profile.id)
      .eq("status", "active");

    return requestedRole
      ? query.eq("role", requestedRole).maybeSingle()
      : query;
  };

  let membershipResult = await membershipQuery(
    "org_id, role, status, organizations(name)",
  );

  if (membershipResult.error) {
    const message = membershipResult.error.message ?? "";
    if (
      message.includes("relationship") ||
      message.includes("organizations") ||
      isMissingProfileColumn(membershipResult.error, "organizations")
    ) {
      membershipResult = await membershipQuery("org_id, role, status");
    }
  }

  const membershipError = membershipResult.error;
  const membershipRows = Array.isArray(membershipResult.data)
    ? (membershipResult.data as unknown as MembershipRow[])
    : membershipResult.data
      ? ([membershipResult.data] as unknown as MembershipRow[])
      : [];
  const membership = membershipRows.length
    ? membershipRows.sort(
        (a, b) =>
          bootstrapRoles.indexOf(b.role as Role) -
          bootstrapRoles.indexOf(a.role as Role),
      )[0]
    : null;

  if (membershipError) {
    if (isMissingSchemaError(membershipError) && allowSelfSignup) {
      return provisionalMembership(requestedRole);
    }

    if (allowSelfSignup && selfSignupEnabled() && !requestedRole) {
      return tryEnsureStudentMembership({
        supabase,
        uid,
        email,
        displayName,
      });
    }

    throw membershipError;
  }

  if (!membership) {
    if (allowSelfSignup && selfSignupEnabled() && !requestedRole) {
      return tryEnsureStudentMembership({
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
    avatarUrl: profile.avatarUrl,
    onboardingCompleted: profile.onboardingCompleted,
  };
}

async function profileSessionIdentity(
  supabase: SupabaseServiceClient | null,
  uid: string,
) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name,avatar_url,onboarding_completed_at")
    .eq("firebase_uid", uid)
    .maybeSingle();

  if (error) {
    if (
      isMissingProfileColumn(error, "avatar_url") ||
      isMissingProfileColumn(error, "onboarding_completed_at")
    ) {
      const fallback = await supabase
        .from("profiles")
        .select("display_name")
        .eq("firebase_uid", uid)
        .maybeSingle();

      if (fallback.error) throw fallback.error;
      return fallback.data
        ? {
            displayName:
              typeof fallback.data.display_name === "string"
                ? fallback.data.display_name
                : null,
            avatarUrl: null,
            onboardingCompleted: null,
          }
        : null;
    }
    throw error;
  }

  return data
    ? {
        displayName:
          typeof data.display_name === "string" ? data.display_name : null,
        avatarUrl: typeof data.avatar_url === "string" ? data.avatar_url : null,
        onboardingCompleted: Boolean(data.onboarding_completed_at),
      }
    : null;
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

  const { error } = await supabase.from("device_sessions").upsert(
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

  if (error) {
    console.warn("Device session skipped", error.code);
  }
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
    }).catch((error) => {
      console.warn(
        "Device session write skipped",
        error instanceof Error ? error.message : "unknown",
      );
    });

    const token = await signAppSession({
      uid: verified.uid,
      email: body.email ?? verified.email ?? null,
      displayName: body.displayName,
      role: membership.role,
      orgId: membership.orgId,
      orgName: membership.orgName,
      deviceSessionId: body.deviceSessionId,
      photoURL: membership.avatarUrl,
      onboardingCompleted: membership.onboardingCompleted,
    });

    const response = NextResponse.json({
      ok: true,
      role: membership.role,
      orgId: membership.orgId,
      orgName: membership.orgName,
      photoURL: membership.avatarUrl,
      onboardingCompleted: membership.onboardingCompleted,
      setupPending: Boolean(membership.setupPending),
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

export async function GET() {
  const session = await getCurrentAppSession();

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const identity = await profileSessionIdentity(
    getSupabaseServiceClient(),
    session.uid,
  ).catch(() => null);

  return NextResponse.json({
    ok: true,
    user: {
      uid: session.uid,
      email: session.email,
      displayName: identity?.displayName ?? session.displayName,
      photoURL: identity?.avatarUrl ?? session.photoURL ?? null,
      emailVerified: true,
      role: session.role,
      orgId: session.orgId,
      orgName: session.orgName,
      deviceSessionId: session.deviceSessionId,
      onboardingCompleted:
        identity?.onboardingCompleted ?? session.onboardingCompleted ?? true,
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
