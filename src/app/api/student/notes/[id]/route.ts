import { NextResponse } from "next/server";
import {
  isWorkflowResponse,
  requireWorkflowContext,
  writeAuditLog,
  type WorkflowContext,
} from "@/lib/server/workflow-auth";

export const runtime = "nodejs";

type DbRecord = Record<string, unknown>;
type DbError = { code?: string; message?: string };

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): DbRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DbRecord)
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function isMissingColumn(error: unknown, column: string) {
  const candidate = error as DbError | null;

  return (
    candidate?.code === "42703" ||
    candidate?.code === "PGRST204" ||
    Boolean(candidate?.message?.includes(column))
  );
}

async function loadOwnedNote(context: WorkflowContext, noteId: string) {
  const result = await context.supabase
    .from("resources")
    .select("id,title,class_id,file_path,metadata")
    .eq("org_id", context.session.orgId)
    .eq("id", noteId)
    .maybeSingle();

  if (result.error && isMissingColumn(result.error, "metadata")) {
    return {
      data: null,
      error: new Error("Student note ownership metadata is not available."),
    };
  }

  if (result.error || !result.data) return result;

  const metadata = recordValue((result.data as DbRecord).metadata);
  const ownerProfileId = stringValue(
    metadata.owner_profile_id ?? metadata.ownerProfileId,
  );

  if (!ownerProfileId || ownerProfileId !== context.profileId) {
    return {
      data: null,
      error: new Error("You can only manage notes you created."),
    };
  }

  return result;
}

async function verifyStudentClassAccess(
  context: WorkflowContext,
  classId: string,
) {
  if (!context.profileId) return false;

  const { data, error } = await context.supabase
    .from("enrollments")
    .select("id")
    .eq("org_id", context.session.orgId)
    .eq("class_id", classId)
    .eq("student_id", context.profileId)
    .maybeSingle();

  return !error && Boolean(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext(["student"]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await params;
  const owned = await loadOwnedNote(context, id);
  if (owned.error || !owned.data) {
    return NextResponse.json(
      { ok: false, error: "Note was not found or cannot be edited." },
      { status: 404 },
    );
  }

  const formData = await request.formData();
  const title = textValue(formData, "title");
  const body = textValue(formData, "body") || null;
  const classId = textValue(formData, "classId") || null;
  const externalUrl = textValue(formData, "externalUrl") || null;

  if (!title) {
    return NextResponse.json(
      { ok: false, error: "Add a note title." },
      { status: 400 },
    );
  }

  if (classId && !(await verifyStudentClassAccess(context, classId))) {
    return NextResponse.json(
      { ok: false, error: "You can only attach notes to your own classes." },
      { status: 403 },
    );
  }

  const currentMetadata = recordValue((owned.data as DbRecord).metadata);
  const metadata = {
    ...currentMetadata,
    owner_profile_id: context.profileId,
    owner_role: "student",
    visibility: classId ? "class" : "private",
  };

  let result = await context.supabase
    .from("resources")
    .update({
      title,
      body,
      class_id: classId,
      external_url: externalUrl,
      type: externalUrl ? "link" : "rich_note",
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId)
    .select("id,title,created_at")
    .single();

  if (
    result.error &&
    (isMissingColumn(result.error, "metadata") ||
      isMissingColumn(result.error, "updated_at") ||
      isMissingColumn(result.error, "external_url"))
  ) {
    result = await context.supabase
      .from("resources")
      .update({
        title,
        body,
        class_id: classId,
        type: externalUrl ? "link" : "rich_note",
      })
      .eq("id", id)
      .eq("org_id", context.session.orgId)
      .select("id,title,created_at")
      .single();
  }

  if (result.error) {
    return NextResponse.json(
      { ok: false, error: "Unable to update note." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "student.note.updated",
    entity: "resources",
    entityId: id,
    metadata: { classId, visibility: metadata.visibility },
  });

  return NextResponse.json({ ok: true, note: result.data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireWorkflowContext(["student"]);
  if (isWorkflowResponse(context)) return context;

  const { id } = await params;
  const owned = await loadOwnedNote(context, id);
  if (owned.error || !owned.data) {
    return NextResponse.json(
      { ok: false, error: "Note was not found or cannot be deleted." },
      { status: 404 },
    );
  }

  const filePath = stringValue((owned.data as DbRecord).file_path);
  if (filePath) {
    await context.supabase.storage.from("resources").remove([filePath]);
  }

  let result = await context.supabase
    .from("resources")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", context.session.orgId);

  if (
    result.error &&
    (isMissingColumn(result.error, "archived_at") ||
      isMissingColumn(result.error, "updated_at"))
  ) {
    result = await context.supabase
      .from("resources")
      .delete()
      .eq("id", id)
      .eq("org_id", context.session.orgId);
  }

  if (result.error) {
    return NextResponse.json(
      { ok: false, error: "Unable to delete note." },
      { status: 500 },
    );
  }

  await writeAuditLog(context, {
    action: "student.note.deleted",
    entity: "resources",
    entityId: id,
    metadata: { filePath },
  });

  return NextResponse.json({ ok: true });
}
