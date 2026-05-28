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

function relation(row: DbRecord, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

export async function GET() {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  let classIds: string[] | null = null;
  if (context.session.role === "teacher") {
    const { data: classes, error } = await context.supabase
      .from("classes")
      .select("id")
      .eq("org_id", context.session.orgId)
      .eq("teacher_id", context.profileId)
      .is("archived_at", null);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Unable to load teacher classes." },
        { status: 500 },
      );
    }

    classIds = ((classes ?? []) as Array<{ id: string }>).map((row) => row.id);
    if (classIds.length === 0) {
      return NextResponse.json({ ok: true, submissions: [] });
    }
  }

  let query = context.supabase
    .from("submissions")
    .select(
      "id,status,score,feedback,submitted_at,graded_at,file_path,content,assignments(id,title,class_id,points,classes(name,section)),profiles(id,display_name,username,email)",
    )
    .eq("org_id", context.session.orgId)
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (classIds) {
    query = query.in("assignments.class_id", classIds);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to load submissions." },
      { status: 500 },
    );
  }

  const submissions = ((data ?? []) as DbRecord[]).map((row) => {
    const assignment = relation(row, "assignments");
    const profile = relation(row, "profiles");
    return {
      id: stringValue(row.id),
      status: stringValue(row.status, "submitted"),
      score: typeof row.score === "number" ? row.score : null,
      feedback: stringValue(row.feedback) || null,
      submittedAt: stringValue(row.submitted_at),
      gradedAt: stringValue(row.graded_at) || null,
      filePath: stringValue(row.file_path) || null,
      content: stringValue(row.content) || null,
      assignment: {
        id: stringValue(assignment?.id),
        title: stringValue(assignment?.title, "Assignment"),
        points: typeof assignment?.points === "number" ? assignment.points : 0,
      },
      student: {
        id: stringValue(profile?.id),
        name: stringValue(profile?.display_name, "Student"),
        username: stringValue(profile?.username) || null,
        email: stringValue(profile?.email) || null,
      },
    };
  });

  return NextResponse.json({ ok: true, submissions });
}
