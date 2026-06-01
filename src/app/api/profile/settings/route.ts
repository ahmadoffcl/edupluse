import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppSession } from "@/lib/auth/server";
import { ensureSessionProfile } from "@/lib/server/workflow-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { isValidUsername, normalizeUsername } from "@/lib/username";

export const runtime = "nodejs";

const schema = z.object({
  displayName: z.string().trim().min(2).max(120),
  username: z
    .string()
    .trim()
    .max(33)
    .optional()
    .or(z.literal(""))
    .transform((value) => normalizeUsername(value) || null)
    .refine((value) => !value || isValidUsername(value), {
      message: "Username must be 3-32 letters, numbers, dots, or underscores.",
    }),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9+\-() ]*$/)
    .optional()
    .transform((value) => value || null),
  bio: z
    .string()
    .trim()
    .max(220)
    .optional()
    .transform((value) => value || null),
  avatarUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null)
    .refine((value) => !value || /^https?:\/\//i.test(value), {
      message: "Use a normal http or https image URL, or upload a photo.",
    }),
  notifications: z.boolean().default(true),
  weeklyDigest: z.boolean().default(true),
  publicLeaderboard: z.boolean().default(true),
});

function isMissingProfileColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "PGRST204" ||
    candidate.code === "42703" ||
    Boolean(
      candidate.message?.includes("schema cache") ||
      candidate.message?.includes("does not exist"),
    )
  );
}

export async function PATCH(request: Request) {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Workspace data is unavailable." },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check your profile details." },
      { status: 400 },
    );
  }

  const profileId = await ensureSessionProfile(supabase, session);

  if (!profileId) {
    return NextResponse.json(
      { error: "Profile is not ready yet. Sign out and sign in again." },
      { status: 404 },
    );
  }

  const body = parsed.data;

  if (body.username) {
    const { data: existingProfile, error: usernameError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", body.username)
      .neq("id", profileId)
      .maybeSingle();

    if (usernameError && !isMissingProfileColumn(usernameError)) {
      return NextResponse.json(
        { error: "Unable to check username." },
        { status: 500 },
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 },
      );
    }
  }

  const fullPayload = {
    display_name: body.displayName,
    username: body.username,
    phone: body.phone,
    bio: body.bio,
    avatar_url: body.avatarUrl,
    profile_settings: {
      notifications: body.notifications,
      weeklyDigest: body.weeklyDigest,
      publicLeaderboard: body.publicLeaderboard,
    },
    updated_at: new Date().toISOString(),
  };

  const selectColumns =
    "display_name,username,phone,bio,avatar_url,profile_settings";
  let result = await supabase
    .from("profiles")
    .update(fullPayload)
    .eq("id", profileId)
    .select(selectColumns)
    .single();

  if (result.error && isMissingProfileColumn(result.error)) {
    result = await supabase
      .from("profiles")
      .update({
        display_name: body.displayName,
        avatar_url: body.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .select("display_name,avatar_url")
      .single();
  }

  if (result.error) {
    return NextResponse.json(
      { error: "Unable to save profile settings." },
      { status: 500 },
    );
  }

  const saved = (result.data ?? {}) as Record<string, unknown>;
  const settings =
    saved.profile_settings && typeof saved.profile_settings === "object"
      ? (saved.profile_settings as Record<string, unknown>)
      : {};

  return NextResponse.json({
    ok: true,
    profile: {
      displayName:
        typeof saved.display_name === "string"
          ? saved.display_name
          : body.displayName,
      username:
        typeof saved.username === "string"
          ? `@${saved.username}`
          : body.username
            ? `@${body.username}`
            : "",
      phone: typeof saved.phone === "string" ? saved.phone : (body.phone ?? ""),
      bio: typeof saved.bio === "string" ? saved.bio : (body.bio ?? ""),
      avatarUrl:
        typeof saved.avatar_url === "string"
          ? saved.avatar_url
          : (body.avatarUrl ?? ""),
      notifications:
        typeof settings.notifications === "boolean"
          ? settings.notifications
          : body.notifications,
      weeklyDigest:
        typeof settings.weeklyDigest === "boolean"
          ? settings.weeklyDigest
          : body.weeklyDigest,
      publicLeaderboard:
        typeof settings.publicLeaderboard === "boolean"
          ? settings.publicLeaderboard
          : body.publicLeaderboard,
    },
  });
}
