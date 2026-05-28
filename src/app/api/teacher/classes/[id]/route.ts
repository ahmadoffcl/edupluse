import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  gradeLevel: z.string().trim().max(80).optional().nullable(),
  section: z.string().trim().max(80).optional().nullable(),
  batch: z.string().trim().max(80).optional().nullable(),
  deliveryMode: z.enum(["physical", "online", "hybrid"]).optional(),
  term: z.string().trim().max(80).optional().nullable(),
  capacity: z.coerce.number().int().min(0).max(10000).optional().nullable(),
  scheduleNote: z.string().trim().max(500).optional().nullable(),
  subjectName: z.string().trim().max(120).optional().nullable(),
  subjectCode: z.string().trim().max(40).optional().nullable(),
});

export async function GET(
  _request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await contextParams.params;
  const access = await requireClassAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const { data, error } = await context.supabase
    .from("classes")
    .select(
      "*,subjects(id,name,code),enrollments(id,profiles(id,display_name,username,email))",
    )
    .eq("id", id)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to load class." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, class: data });
}

export async function PATCH(
  request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await contextParams.params;
  const access = await requireClassAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const body = patchSchema.parse(await request.json());
  const patch = {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.gradeLevel !== undefined
      ? { grade_level: body.gradeLevel || null }
      : {}),
    ...(body.section !== undefined ? { section: body.section || null } : {}),
    ...(body.batch !== undefined ? { batch: body.batch || null } : {}),
    ...(body.deliveryMode !== undefined
      ? { delivery_mode: body.deliveryMode }
      : {}),
    ...(body.term !== undefined ? { term: body.term || null } : {}),
    ...(body.capacity !== undefined ? { capacity: body.capacity ?? null } : {}),
    ...(body.scheduleNote !== undefined
      ? { schedule_note: body.scheduleNote || null }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await context.supabase
    .from("classes")
    .update(patch)
    .eq("id", id)
    .eq("org_id", context.session.orgId)
    .select("id,name")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to update class." },
      { status: 500 },
    );
  }

  let subject = null;
  if (body.subjectName) {
    const { data: existingSubject } = await context.supabase
      .from("subjects")
      .select("id")
      .eq("org_id", context.session.orgId)
      .eq("class_id", id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const subjectPayload = {
      org_id: context.session.orgId,
      class_id: id,
      name: body.subjectName,
      code: body.subjectCode || null,
    };

    const result = existingSubject?.id
      ? await context.supabase
          .from("subjects")
          .update(subjectPayload)
          .eq("id", existingSubject.id)
          .select("id,name,code")
          .single()
      : await context.supabase
          .from("subjects")
          .insert(subjectPayload)
          .select("id,name,code")
          .single();

    subject = result.data;
  }

  await writeAuditLog(context, {
    action: "teacher.class.updated",
    entity: "classes",
    entityId: id,
    metadata: { subjectId: subject?.id ?? null },
  });

  return NextResponse.json({ ok: true, class: data, subject });
}

export async function DELETE(
  _request: Request,
  contextParams: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext([
    "teacher",
    "admin",
    "super_admin",
  ]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await contextParams.params;
  const access = await requireClassAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const { error } = await context.supabase
    .from("classes")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to archive class." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.class.archived",
    entity: "classes",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
