import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  classId: z.string().uuid(),
  attendedOn: z.string().date(),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(["present", "absent", "late", "excused"]),
        note: z.string().trim().max(300).optional().nullable(),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const body = schema.parse(await request.json());
  const classAccess = await requireClassAccess(context, body.classId);
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

  const { data: enrollments } = await context.supabase
    .from("enrollments")
    .select("student_id")
    .eq("org_id", context.session.orgId)
    .eq("class_id", body.classId)
    .in(
      "student_id",
      body.records.map((record) => record.studentId),
    );
  const enrolledIds = new Set(
    ((enrollments ?? []) as Array<{ student_id: string }>).map(
      (row) => row.student_id,
    ),
  );
  const allStudentsBelongToClass = body.records.every((record) =>
    enrolledIds.has(record.studentId),
  );

  if (!allStudentsBelongToClass) {
    return NextResponse.json(
      {
        ok: false,
        error: "Attendance can only be marked for enrolled students.",
      },
      { status: 403 },
    );
  }

  const rows = body.records.map((record) => ({
    org_id: context.session.orgId,
    class_id: body.classId,
    student_id: record.studentId,
    marked_by: context.profileId,
    attended_on: body.attendedOn,
    status: record.status,
    note: record.note || null,
  }));

  const { error } = await context.supabase
    .from("attendance_records")
    .upsert(rows, { onConflict: "class_id,student_id,attended_on" });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to save attendance." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.attendance.marked",
    entity: "attendance_records",
    metadata: {
      classId: body.classId,
      attendedOn: body.attendedOn,
      count: rows.length,
    },
  });

  return NextResponse.json({ ok: true, count: rows.length });
}
