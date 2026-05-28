import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1200).optional().nullable(),
  bannerUrl: z.string().trim().url().max(1000).optional().or(z.literal("")),
  gradeLevel: z.string().trim().max(80).optional().nullable(),
  section: z.string().trim().max(80).optional().nullable(),
  batch: z.string().trim().max(80).optional().nullable(),
  deliveryMode: z.enum(["physical", "online", "hybrid"]).default("hybrid"),
  term: z.string().trim().max(80).optional().nullable(),
  capacity: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  scheduleNote: z.string().trim().max(500).optional().nullable(),
  subjectName: z.string().trim().max(120).optional().nullable(),
  subjectCode: z.string().trim().max(40).optional().nullable(),
  studentIds: z.array(z.string().uuid()).max(500).optional().default([]),
});

function baseClassPayload(
  body: z.infer<typeof schema>,
  orgId: string,
  teacherId: string | null,
) {
  return {
    org_id: orgId,
    name: body.name,
    grade_level: body.gradeLevel || null,
    section: body.section || null,
    batch: body.batch || null,
    delivery_mode: body.deliveryMode,
    term: body.term || null,
    teacher_id: teacherId,
  };
}

export async function POST(request: Request) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const body = schema.parse(await request.json());
  const fullPayload = {
    ...baseClassPayload(body, context.session.orgId, context.profileId),
    description: body.description || null,
    banner_url: body.bannerUrl || null,
    capacity: body.capacity ?? null,
    schedule_note: body.scheduleNote || null,
  };

  let classResult = await context.supabase
    .from("classes")
    .insert(fullPayload)
    .select("id,name")
    .single();

  if (classResult.error) {
    classResult = await context.supabase
      .from("classes")
      .insert(baseClassPayload(body, context.session.orgId, context.profileId))
      .select("id,name")
      .single();
  }

  if (classResult.error || !classResult.data) {
    return NextResponse.json(
      { ok: false, error: "Unable to create class." },
      { status: 500 },
    );
  }

  const classRecord = classResult.data;
  let subject = null;
  if (body.subjectName) {
    const { data } = await context.supabase
      .from("subjects")
      .insert({
        org_id: context.session.orgId,
        class_id: classRecord.id,
        name: body.subjectName,
        code: body.subjectCode || null,
      })
      .select("id,name")
      .single();
    subject = data;
  }

  let enrolledCount = 0;
  if (body.studentIds.length > 0) {
    const { data: studentMemberships, error: studentLookupError } =
      await context.supabase
        .from("memberships")
        .select("profile_id")
        .eq("org_id", context.session.orgId)
        .eq("role", "student")
        .eq("status", "active")
        .in("profile_id", body.studentIds);

    if (studentLookupError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Class was created, but students could not be verified.",
        },
        { status: 500 },
      );
    }

    const validStudentIds = new Set(
      (studentMemberships ?? []).map((membership) => membership.profile_id),
    );
    const enrollments = body.studentIds
      .filter((studentId) => validStudentIds.has(studentId))
      .map((studentId) => ({
        org_id: context.session.orgId,
        class_id: classRecord.id,
        student_id: studentId,
      }));

    if (enrollments.length > 0) {
      const { error: enrollmentError } = await context.supabase
        .from("enrollments")
        .upsert(enrollments, {
          onConflict: "class_id,student_id",
          ignoreDuplicates: true,
        });

      if (enrollmentError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Class was created, but students could not be added.",
          },
          { status: 500 },
        );
      }
    }

    enrolledCount = enrollments.length;
  }

  await writeAuditLog(context, {
    action: "teacher.class.created",
    entity: "classes",
    entityId: classRecord.id,
    metadata: { subjectId: subject?.id ?? null, enrolledCount },
  });

  return NextResponse.json({
    ok: true,
    class: classRecord,
    subject,
    enrolledCount,
  });
}
