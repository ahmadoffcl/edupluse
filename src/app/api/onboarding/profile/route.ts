import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppSession } from "@/lib/auth/server";
import { requestClassJoins } from "@/lib/server/class-join-requests";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  username: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^@?[a-zA-Z0-9._]+$/)
    .optional(),
  bio: z.string().trim().max(180).optional(),
  selectedClassIds: z.array(z.string().uuid()).max(25).optional().default([]),
  academic: z
    .object({
      institutionName: z.string().trim().max(160).optional(),
      departmentName: z.string().trim().max(120).optional(),
      program: z.string().trim().max(120).optional(),
      semesterYear: z.string().trim().max(80).optional(),
    })
    .optional(),
  details: z
    .object({
      section: z.string().trim().max(80).optional(),
      registrationNumber: z.string().trim().max(80).optional(),
      studentId: z.string().trim().max(80).optional(),
      campus: z.string().trim().max(120).optional(),
    })
    .optional(),
});
type SupabaseServiceClient = NonNullable<
  ReturnType<typeof getSupabaseServiceClient>
>;

function cleanUsername(username?: string) {
  return username?.replace(/^@+/, "").toLowerCase();
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

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

function isMissingOptionalProfileColumn(error: unknown) {
  return (
    isMissingProfileColumn(error, "username") ||
    isMissingProfileColumn(error, "bio") ||
    isMissingProfileColumn(error, "onboarding_completed_at") ||
    isMissingProfileColumn(error, "profile_settings")
  );
}

function setupPendingResponse() {
  return NextResponse.json({ ok: true, setupPending: true });
}

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function createProfile({
  supabase,
  uid,
  email,
  displayName,
  username,
  bio,
  profileSettings,
}: {
  supabase: SupabaseServiceClient;
  uid: string;
  email: string | null;
  displayName: string;
  username?: string;
  bio?: string;
  profileSettings?: Record<string, unknown>;
}) {
  const basePayload = {
    firebase_uid: uid,
    email,
    display_name: displayName,
  };
  const fullPayload = {
    ...basePayload,
    username: username ?? null,
    bio: bio ?? null,
    onboarding_completed_at: new Date().toISOString(),
    ...(profileSettings ? { profile_settings: profileSettings } : {}),
  };

  let result = await supabase
    .from("profiles")
    .upsert(fullPayload, { onConflict: "firebase_uid" })
    .select("id")
    .single();

  if (result.error && isMissingOptionalProfileColumn(result.error)) {
    result = await supabase
      .from("profiles")
      .upsert(basePayload, { onConflict: "firebase_uid" })
      .select("id")
      .single();
  }

  if (result.error) throw result.error;

  return result.data.id as string;
}

async function updateProfile({
  supabase,
  profileId,
  displayName,
  username,
  bio,
  profileSettings,
}: {
  supabase: SupabaseServiceClient;
  profileId: string;
  displayName: string;
  username?: string;
  bio?: string;
  profileSettings?: Record<string, unknown>;
}) {
  const fullPayload = {
    display_name: displayName,
    username: username ?? null,
    bio: bio ?? null,
    onboarding_completed_at: new Date().toISOString(),
    ...(profileSettings ? { profile_settings: profileSettings } : {}),
  };

  let result = await supabase
    .from("profiles")
    .update(fullPayload)
    .eq("id", profileId);

  if (result.error && isMissingOptionalProfileColumn(result.error)) {
    result = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", profileId);
  }

  if (result.error) throw result.error;
}

export async function POST(request: Request) {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!supabase) {
    return setupPendingResponse();
  }

  const currentSession = session;
  const db = supabase;

  const rawBody = await request.json().catch(() => null);
  const parsedBody = schema.safeParse(rawBody);

  if (!parsedBody.success) {
    return validationError(
      "Please check your display name, username, and bio before continuing.",
    );
  }

  const body = parsedBody.data;
  const username = cleanUsername(body.username);
  const onboardingSettings =
    currentSession.role === "student"
      ? {
          academic: body.academic ?? {},
          details: body.details ?? {},
          completedAt: new Date().toISOString(),
        }
      : null;

  let currentProfileResult = await supabase
    .from("profiles")
    .select("id,profile_settings")
    .eq("firebase_uid", currentSession.uid)
    .maybeSingle();

  if (
    currentProfileResult.error &&
    isMissingProfileColumn(currentProfileResult.error, "profile_settings")
  ) {
    currentProfileResult = await supabase
      .from("profiles")
      .select("id")
      .eq("firebase_uid", currentSession.uid)
      .maybeSingle();
  }

  const currentProfile = currentProfileResult.data as {
    id: string;
    profile_settings?: unknown;
  } | null;
  const currentProfileError = currentProfileResult.error;

  if (currentProfileError) {
    if (isMissingSchemaError(currentProfileError)) {
      return setupPendingResponse();
    }

    return NextResponse.json(
      { error: "Unable to load your profile." },
      { status: 500 },
    );
  }

  async function requestSelectedClasses(profileId: string) {
    if (
      currentSession.role !== "student" ||
      body.selectedClassIds.length === 0
    ) {
      return;
    }

    await requestClassJoins({
      supabase: db,
      orgId: currentSession.orgId,
      studentId: profileId,
      studentName: body.displayName ?? currentSession.displayName,
      classIds: body.selectedClassIds,
    });
  }

  if (!currentProfile) {
    if (username) {
      const { data: existingProfile, error: existingProfileError } =
        await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .maybeSingle();

      if (existingProfileError) {
        if (isMissingProfileColumn(existingProfileError, "username")) {
          // Older schemas may not have social usernames yet; keep onboarding moving.
        } else if (isMissingSchemaError(existingProfileError)) {
          return setupPendingResponse();
        } else {
          return NextResponse.json(
            { error: "Unable to check username." },
            { status: 500 },
          );
        }
      }

      if (existingProfile) {
        return NextResponse.json(
          { error: "That username is already taken." },
          { status: 409 },
        );
      }
    }

    const { error: organizationError } = await supabase
      .from("organizations")
      .upsert(
        {
          id: session.orgId,
          name: session.orgName,
          slug: session.orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          tenant_type: "hybrid_institute",
          status: "active",
        },
        { onConflict: "id" },
      );

    if (organizationError) {
      if (isMissingSchemaError(organizationError)) {
        return setupPendingResponse();
      }

      return NextResponse.json(
        { error: "Unable to prepare your workspace." },
        { status: 500 },
      );
    }

    let createdProfileId: string;

    try {
      createdProfileId = await createProfile({
        supabase,
        uid: session.uid,
        email: session.email,
        displayName: body.displayName ?? session.displayName,
        username,
        bio: body.bio,
        profileSettings: onboardingSettings
          ? { studentOnboarding: onboardingSettings }
          : undefined,
      });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return setupPendingResponse();
      }

      return NextResponse.json(
        { error: "Unable to create your profile." },
        { status: 500 },
      );
    }

    const { error: membershipError } = await supabase
      .from("memberships")
      .upsert(
        {
          org_id: session.orgId,
          profile_id: createdProfileId,
          role: session.role,
          status: "active",
        },
        { onConflict: "org_id,profile_id,role" },
      );

    if (membershipError) {
      if (isMissingSchemaError(membershipError)) {
        return setupPendingResponse();
      }

      return NextResponse.json(
        { error: "Unable to activate your dashboard access." },
        { status: 500 },
      );
    }

    await requestSelectedClasses(createdProfileId);

    return NextResponse.json({ ok: true });
  }

  if (username) {
    const { data: existingProfile, error: existingProfileError } =
      await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", currentProfile.id)
        .maybeSingle();

    if (existingProfileError) {
      if (isMissingProfileColumn(existingProfileError, "username")) {
        // Older schemas may not have social usernames yet; keep onboarding moving.
      } else if (isMissingSchemaError(existingProfileError)) {
        return setupPendingResponse();
      } else {
        return NextResponse.json(
          { error: "Unable to check username." },
          { status: 500 },
        );
      }
    }

    if (existingProfile) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 },
      );
    }
  }

  try {
    await updateProfile({
      supabase,
      profileId: currentProfile.id,
      displayName: body.displayName ?? session.displayName,
      username,
      bio: body.bio,
      profileSettings: onboardingSettings
        ? {
            ...recordValue(currentProfile.profile_settings),
            studentOnboarding: onboardingSettings,
          }
        : undefined,
    });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return setupPendingResponse();
    }

    return NextResponse.json(
      { error: "Unable to save your onboarding profile." },
      { status: 500 },
    );
  }

  await requestSelectedClasses(currentProfile.id);

  return NextResponse.json({ ok: true });
}
