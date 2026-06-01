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
  description: z.string().trim().max(1200).optional().nullable(),
  bannerUrl: z
    .string()
    .trim()
    .url()
    .max(1000)
    .optional()
    .nullable()
    .or(z.literal("")),
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

function isMissingRelation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(
      candidate.message?.includes("schema cache") ||
        candidate.message?.includes("does not exist"),
    )
  );
}

function isMissingColumn(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    Boolean(
      candidate.message?.includes("schema cache") ||
        candidate.message?.includes("does not exist"),
    )
  );
}

function collectAttachmentPaths(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      item && typeof item === "object"
        ? (item as { path?: unknown }).path
        : null,
    )
    .filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );
}

async function safeDelete(query: PromiseLike<{ error: unknown | null }>) {
  const result = await query;
  if (
    result.error &&
    !isMissingRelation(result.error) &&
    !isMissingColumn(result.error)
  ) {
    throw result.error;
  }
}

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
    ...(body.description !== undefined
      ? { description: body.description || null }
      : {}),
    ...(body.bannerUrl !== undefined
      ? { banner_url: body.bannerUrl || null }
      : {}),
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

  const [{ data: resourceRows }, { data: assignmentRows }] =
    await Promise.all([
      context.supabase
        .from("resources")
        .select("file_path")
        .eq("org_id", context.session.orgId)
        .eq("class_id", id),
      context.supabase
        .from("assignments")
        .select("id,attachments")
        .eq("org_id", context.session.orgId)
        .eq("class_id", id),
    ]);

  const assignmentIds = ((assignmentRows ?? []) as Array<{ id: string }>).map(
    (row) => row.id,
  );
  const resourcePaths = ((resourceRows ?? []) as Array<{
    file_path?: string | null;
  }>)
    .map((row) => row.file_path)
    .filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );
  const attachmentPaths = ((assignmentRows ?? []) as Array<{
    attachments?: unknown;
  }>).flatMap((row) => collectAttachmentPaths(row.attachments));
  let submissionPaths: string[] = [];

  if (assignmentIds.length > 0) {
    const { data: submissionRows } = await context.supabase
      .from("submissions")
      .select("file_path")
      .eq("org_id", context.session.orgId)
      .in("assignment_id", assignmentIds);

    submissionPaths = ((submissionRows ?? []) as Array<{
      file_path?: string | null;
    }>)
      .map((row) => row.file_path)
      .filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      );
  }

  const orgPath = `${context.session.orgId}/`;
  const resourceStoragePaths = Array.from(
    new Set([...resourcePaths, ...attachmentPaths].filter((path) => path.startsWith(orgPath))),
  );
  const submissionStoragePaths = Array.from(
    new Set(submissionPaths.filter((path) => path.startsWith(orgPath))),
  );

  if (resourceStoragePaths.length > 0) {
    const { error: storageError } = await context.supabase.storage
      .from("resources")
      .remove(resourceStoragePaths);
    if (storageError) {
      console.warn("Class resource file cleanup skipped", storageError.message);
    }
  }

  if (submissionStoragePaths.length > 0) {
    const { error: storageError } = await context.supabase.storage
      .from("submissions")
      .remove(submissionStoragePaths);
    if (storageError) {
      console.warn(
        "Class submission file cleanup skipped",
        storageError.message,
      );
    }
  }

  try {
    await safeDelete(
      context.supabase
        .from("invites")
        .delete()
        .eq("org_id", context.session.orgId)
        .eq("class_id", id),
    );
    await safeDelete(
      context.supabase
        .from("notifications")
        .delete()
        .eq("org_id", context.session.orgId)
        .like("action_url", `%/classes/${id}%`),
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to clear class invite or notification data." },
      { status: 500 },
    );
  }

  const { error } = await context.supabase
    .from("classes")
    .delete()
    .eq("id", id)
    .eq("org_id", context.session.orgId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Unable to delete class." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "teacher.class.deleted",
    entity: "classes",
    entityId: id,
    metadata: {
      assignmentCount: assignmentIds.length,
      resourceFileCount: resourceStoragePaths.length,
      submissionFileCount: submissionStoragePaths.length,
    },
  });

  return NextResponse.json({ ok: true });
}
