import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireWorkflowContext,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

type DbRecord = Record<string, unknown>;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function GET() {
  const context = await requireWorkflowContext(
    ["student", "teacher", "admin", "super_admin"],
    { profileRequired: false },
  );
  if (isWorkflowResponse(context)) return context;

  if (!context.profileId) {
    return NextResponse.json({ ok: true, notifications: [] });
  }

  const { data, error } = await context.supabase
    .from("notifications")
    .select("id,title,body,kind,read_at,created_at")
    .eq("org_id", context.session.orgId)
    .eq("recipient_id", context.profileId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    return NextResponse.json({ ok: true, notifications: [] });
  }

  const notifications = ((data ?? []) as DbRecord[]).map((row) => ({
    id: stringValue(row.id),
    title: stringValue(row.title, "Notification"),
    body: stringValue(row.body),
    kind: stringValue(row.kind, "info"),
    readAt: stringValue(row.read_at) || null,
    createdAt: stringValue(row.created_at) || new Date().toISOString(),
  }));

  return NextResponse.json({ ok: true, notifications });
}
