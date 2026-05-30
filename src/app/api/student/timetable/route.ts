import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireWorkflowContext,
} from "@/lib/server/workflow-auth";
import { loadStudentTimetableSessions } from "@/lib/timetable/scheduler";

export const runtime = "nodejs";

export async function GET() {
  const context = await requireWorkflowContext(["student", "admin", "super_admin"]);
  if (isWorkflowResponse(context)) return context;

  if (!context.profileId) {
    return NextResponse.json({ ok: true, sessions: [] });
  }

  const sessions = await loadStudentTimetableSessions({
    supabase: context.supabase,
    orgId: context.session.orgId,
    profileId: context.profileId,
    days: 14,
  });

  return NextResponse.json({ ok: true, sessions });
}
