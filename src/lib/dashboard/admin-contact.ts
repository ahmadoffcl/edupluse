import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { isAdminRole } from "@/lib/server/workflow-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type DbRecord = Record<string, unknown>;

export type AdminContactRequest = {
  id: string;
  name: string;
  email: string;
  institute: string | null;
  subject: string;
  message: string;
  status: string;
  replyBody: string | null;
  repliedAt: string | null;
  createdAt: string;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isMissingContactTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(candidate.message?.includes("contact_requests"))
  );
}

export async function getAdminContactRequests(): Promise<
  AdminContactRequest[]
> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !isAdminRole(session.role) || !supabase) return [];

  const { data, error } = await supabase
    .from("contact_requests")
    .select(
      "id,name,email,institute,subject,message,status,reply_body,replied_at,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (!isMissingContactTable(error)) {
      console.warn("Contact inbox unavailable", error.code);
    }
    return [];
  }

  return ((data ?? []) as DbRecord[]).map((row) => ({
    id: stringValue(row.id),
    name: stringValue(row.name, "Unknown sender"),
    email: stringValue(row.email),
    institute: stringValue(row.institute) || null,
    subject: stringValue(row.subject, "Support request"),
    message: stringValue(row.message),
    status: stringValue(row.status, "open"),
    replyBody: stringValue(row.reply_body) || null,
    repliedAt: stringValue(row.replied_at) || null,
    createdAt: stringValue(row.created_at),
  }));
}
