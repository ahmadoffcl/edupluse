import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type DbRecord = Record<string, unknown>;

export type ProfileSettingsData = {
  displayName: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  notifications: boolean;
  weeklyDigest: boolean;
  publicLeaderboard: boolean;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function boolValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

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

export async function getProfileSettings(): Promise<ProfileSettingsData> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();
  const fallback: ProfileSettingsData = {
    displayName: session?.displayName ?? "EduPulse user",
    email: session?.email ?? null,
    username: null,
    phone: null,
    bio: null,
    avatarUrl: null,
    notifications: true,
    weeklyDigest: true,
    publicLeaderboard: true,
  };

  if (!session || !supabase) return fallback;

  let result = await supabase
    .from("profiles")
    .select("display_name,email,username,phone,bio,avatar_url,profile_settings")
    .eq("firebase_uid", session.uid)
    .maybeSingle();

  if (result.error && isMissingProfileColumn(result.error)) {
    result = await supabase
      .from("profiles")
      .select("display_name,email,avatar_url")
      .eq("firebase_uid", session.uid)
      .maybeSingle();
  }

  if (result.error || !result.data) return fallback;

  const row = result.data as DbRecord;
  const settings =
    row.profile_settings && typeof row.profile_settings === "object"
      ? (row.profile_settings as DbRecord)
      : {};

  return {
    displayName: stringValue(row.display_name, fallback.displayName),
    email: stringValue(row.email) || fallback.email,
    username: stringValue(row.username) || null,
    phone: stringValue(row.phone) || null,
    bio: stringValue(row.bio) || null,
    avatarUrl: stringValue(row.avatar_url) || null,
    notifications: boolValue(settings.notifications, true),
    weeklyDigest: boolValue(settings.weeklyDigest, true),
    publicLeaderboard: boolValue(settings.publicLeaderboard, true),
  };
}
