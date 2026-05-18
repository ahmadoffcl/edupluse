import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { roleWeights } from "@/lib/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export type AdminUserRow = {
  id: string;
  profileId: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  username: string | null;
  role: Role;
  status: string;
  joinedAt: string;
  lastSeenAt: string | null;
};

type DbRecord = Record<string, unknown>;

function relation(row: DbRecord, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !supabase) return [];

  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id,role,status,created_at,profiles(id,firebase_uid,email,display_name,username)",
    )
    .eq("org_id", session.orgId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows = (data as DbRecord[]).map((row) => {
    const profile = relation(row, "profiles");

    return {
      id: stringValue(row.id),
      profileId: stringValue(profile?.id),
      firebaseUid: stringValue(profile?.firebase_uid),
      email: stringValue(profile?.email, "No email"),
      displayName: stringValue(profile?.display_name, "Unnamed user"),
      username: stringValue(profile?.username) || null,
      role: stringValue(row.role, "student") as Role,
      status: stringValue(row.status, "active"),
      joinedAt: stringValue(row.created_at, new Date().toISOString()),
      lastSeenAt: null,
    };
  });

  const profileIds = rows.map((row) => row.profileId).filter(Boolean);
  const { data: deviceRows } =
    profileIds.length > 0
      ? await supabase
          .from("device_sessions")
          .select("profile_id,last_seen_at")
          .eq("org_id", session.orgId)
          .in("profile_id", profileIds)
      : { data: [] };

  const latestSeenByProfile = new Map<string, string>();
  for (const row of (deviceRows ?? []) as DbRecord[]) {
    const profileId = stringValue(row.profile_id);
    const lastSeenAt = stringValue(row.last_seen_at);
    const current = latestSeenByProfile.get(profileId);

    if (!current || new Date(lastSeenAt) > new Date(current)) {
      latestSeenByProfile.set(profileId, lastSeenAt);
    }
  }

  const uniqueRows = new Map<string, AdminUserRow>();
  for (const row of rows) {
    const current = uniqueRows.get(row.profileId);
    const enriched = {
      ...row,
      lastSeenAt: latestSeenByProfile.get(row.profileId) ?? null,
    };

    if (!current || roleWeights[enriched.role] > roleWeights[current.role]) {
      uniqueRows.set(row.profileId, enriched);
    }
  }

  return Array.from(uniqueRows.values()).sort((a, b) => {
    const aTime = new Date(a.lastSeenAt ?? a.joinedAt).getTime();
    const bTime = new Date(b.lastSeenAt ?? b.joinedAt).getTime();

    return bTime - aTime;
  });
}
