import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isWorkflowResponse,
  requireAssignmentAccess,
  requireClassAccess,
  requireWorkflowContext,
  writeAuditLog,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

const patchSchema = z.object({
  classId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2).max(180).optional(),
  instructions: z.string().trim().max(4000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  points: z.coerce.number().int().min(0).max(10000).optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
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
  const access = await requireAssignmentAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const { data, error } = await context.supabase
    .from("assignments")
    .select(
      "*,classes(name,section),subjects(name),submissions(id,status,score,profiles(display_name,username,email))",
    )
    .eq("id", id)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to load assignment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, assignment: data });
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
  const access = await requireAssignmentAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const body = patchSchema.parse(await request.json());
  const classAccess = await requireClassAccess(context, body.classId);
  if (classAccess && isWorkflowResponse(classAccess)) return classAccess;

  const now = new Date().toISOString();
  const { data, error } = await context.supabase
    .from("assignments")
    .update({
      ...(body.classId !== undefined ? { class_id: body.classId } : {}),
      ...(body.subjectId !== undefined ? { subject_id: body.subjectId } : {}),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.instructions !== undefined
        ? { instructions: body.instructions || null }
        : {}),
      ...(body.dueAt !== undefined ? { due_at: body.dueAt || null } : {}),
      ...(body.points !== undefined ? { points: body.points } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.status === "published" ? { published_at: now } : {}),
      ...(body.status === "closed" ? { closed_at: now } : {}),
      updated_at: now,
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId)
    .select("id,title,status")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to update assignment." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.assignment.updated",
    entity: "assignments",
    entityId: id,
    metadata: { status: body.status ?? null },
  });

  return NextResponse.json({ ok: true, assignment: data });
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
  const access = await requireAssignmentAccess(context, id);
  if (isWorkflowResponse(access)) return access;

  const now = new Date().toISOString();
  const { error } = await context.supabase
    .from("assignments")
    .update({ status: "closed", closed_at: now, updated_at: now })
    .eq("id", id)
    .eq("org_id", context.session.orgId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to close assignment." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.assignment.closed",
    entity: "assignments",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
