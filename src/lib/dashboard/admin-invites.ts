import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { isAdminRole } from "@/lib/server/workflow-auth";
import { inviteStatus } from "@/lib/server/invite-tokens";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

type DbRecord = Record<string, unknown>;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function relation(row: DbRecord, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

export type AdminInviteRow = {
  id: string;
  email: string;
  role: Role;
  status: string;
  department: string | null;
  section: string | null;
  className: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  usedCount: number;
  maxUses: number;
  createdAt: string;
};

export type AdminInvitesData = {
  invites: AdminInviteRow[];
  classes: Array<{ id: string; name: string; section: string | null }>;
  metrics: Array<{ label: string; value: string; meta: string }>;
};

export async function getAdminInvitesData(): Promise<AdminInvitesData> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !isAdminRole(session.role) || !supabase) {
    return { invites: [], classes: [], metrics: [] };
  }

  const [invitesResult, classesResult] = await Promise.all([
    supabase
      .from("invites")
      .select(
        "id,email,role,expires_at,accepted_at,created_at,department,section,max_uses,used_count,revoked_at,classes(name)",
      )
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("classes")
      .select("id,name,section")
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const invites = ((invitesResult.data ?? []) as DbRecord[]).map((row) => {
    const classRecord = relation(row, "classes");
    return {
      id: stringValue(row.id),
      email: stringValue(row.email),
      role: stringValue(row.role, "student") as Role,
      status: inviteStatus({
        accepted_at: stringValue(row.accepted_at) || null,
        expires_at: stringValue(row.expires_at, new Date().toISOString()),
        revoked_at: stringValue(row.revoked_at) || null,
        used_count: numberValue(row.used_count),
        max_uses: numberValue(row.max_uses, 1),
      }),
      department: stringValue(row.department) || null,
      section: stringValue(row.section) || null,
      className: stringValue(classRecord?.name) || null,
      expiresAt: stringValue(row.expires_at),
      acceptedAt: stringValue(row.accepted_at) || null,
      usedCount: numberValue(row.used_count),
      maxUses: numberValue(row.max_uses, 1),
      createdAt: stringValue(row.created_at),
    };
  });

  const classes = ((classesResult.data ?? []) as DbRecord[]).map((row) => ({
    id: stringValue(row.id),
    name: stringValue(row.name),
    section: stringValue(row.section) || null,
  }));

  const countByStatus = (status: string) =>
    invites.filter((invite) => invite.status === status).length;

  return {
    invites,
    classes,
    metrics: [
      {
        label: "Pending",
        value: `${countByStatus("pending")}`,
        meta: "Waiting for acceptance",
      },
      {
        label: "Accepted",
        value: `${countByStatus("accepted") + countByStatus("used")}`,
        meta: "Joined workspace",
      },
      {
        label: "Expired",
        value: `${countByStatus("expired")}`,
        meta: "Needs renewal",
      },
    ],
  };
}
