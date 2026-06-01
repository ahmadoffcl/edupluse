import "server-only";
import { NextResponse } from "next/server";
import { getCurrentAppSession } from "@/lib/auth/server";
import type { AppSession } from "@/lib/auth/session";
import { canManageTeacherOwnedRecord } from "@/lib/server/access-policy";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

type SupabaseService = NonNullable<ReturnType<typeof getSupabaseServiceClient>>;

export type WorkflowContext = {
  session: NonNullable<Awaited<ReturnType<typeof getCurrentAppSession>>>;
  supabase: SupabaseService;
  profileId: string | null;
};

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function isAdminRole(role: Role) {
  return role === "admin" || role === "super_admin";
}

export function isTeacherRole(role: Role) {
  return role === "teacher" || role === "admin" || role === "super_admin";
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function ensureSessionOrganization(
  supabase: SupabaseService,
  session: AppSession,
) {
  let result = await supabase.from("organizations").upsert(
    {
      id: session.orgId,
      name: session.orgName,
      slug: slugify(session.orgName) || "edupulse-academy-network",
      tenant_type: "hybrid_institute",
      status: "active",
    },
    { onConflict: "id" },
  );

  if (
    result.error &&
    (isMissingColumn(result.error, "slug") ||
      isMissingColumn(result.error, "tenant_type") ||
      isMissingColumn(result.error, "status"))
  ) {
    result = await supabase.from("organizations").upsert(
      {
        id: session.orgId,
        name: session.orgName,
      },
      { onConflict: "id" },
    );
  }

  if (result.error) throw result.error;
}

export async function ensureSessionProfile(
  supabase: SupabaseService,
  session: AppSession,
) {
  const existing = await supabase
    .from("profiles")
    .select("id")
    .eq("firebase_uid", session.uid)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data.id as string;

  const canCreateLocalAdminProfile =
    session.uid.startsWith("local-admin:") && isAdminRole(session.role);

  if (!canCreateLocalAdminProfile) return null;

  await ensureSessionOrganization(supabase, session);

  const baseProfile = {
    firebase_uid: session.uid,
    email: session.email,
    display_name: session.displayName || "EduPulse Admin",
  };
  let profileResult = await supabase
    .from("profiles")
    .upsert(
      {
        ...baseProfile,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: "firebase_uid" },
    )
    .select("id")
    .single();

  if (
    profileResult.error &&
    isMissingColumn(profileResult.error, "onboarding_completed_at")
  ) {
    profileResult = await supabase
      .from("profiles")
      .upsert(baseProfile, { onConflict: "firebase_uid" })
      .select("id")
      .single();
  }

  if (profileResult.error || !profileResult.data?.id) {
    throw profileResult.error ?? new Error("Unable to prepare admin profile.");
  }

  const profileId = profileResult.data.id as string;
  const { error: membershipError } = await supabase.from("memberships").upsert(
    {
      org_id: session.orgId,
      profile_id: profileId,
      role: session.role,
      status: "active",
    },
    { onConflict: "org_id,profile_id,role" },
  );

  if (membershipError) throw membershipError;

  return profileId;
}

export async function requireWorkflowContext(
  allowedRoles: readonly Role[],
  options: { profileRequired?: boolean } = {},
): Promise<WorkflowContext | NextResponse> {
  const session = await getCurrentAppSession();

  if (!session) {
    return jsonError("Unauthorized.", 401);
  }

  if (!allowedRoles.includes(session.role)) {
    return jsonError("Forbidden.", 403);
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return jsonError("Workspace data is unavailable.", 503);
  }

  let profileId: string | null = null;
  try {
    profileId = await ensureSessionProfile(supabase, session);
  } catch {
    return jsonError("Unable to load your profile.", 500);
  }

  if (!profileId && options.profileRequired !== false) {
    return jsonError("Profile is not ready yet.", 404);
  }

  return {
    session,
    supabase,
    profileId,
  };
}

export function isWorkflowResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

function isMissingRelation(error: unknown, relation: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(
      candidate.message?.includes(relation) &&
      (candidate.message.includes("schema cache") ||
        candidate.message.includes("does not exist")),
    )
  );
}

function isMissingColumn(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    Boolean(
      candidate.message?.includes(column) &&
      (candidate.message.includes("schema cache") ||
        candidate.message.includes("does not exist")),
    )
  );
}

async function hasClassTeacherAccess(
  context: WorkflowContext,
  classId: string | null | undefined,
) {
  if (!classId || !context.profileId) return false;

  const activeQuery = await context.supabase
    .from("class_teachers")
    .select("id")
    .eq("org_id", context.session.orgId)
    .eq("class_id", classId)
    .eq("teacher_id", context.profileId)
    .eq("status", "active")
    .is("removed_at", null)
    .maybeSingle();

  if (!activeQuery.error) return Boolean(activeQuery.data);

  const error = activeQuery.error;
  if (error && isMissingRelation(error, "class_teachers")) return false;
  if (!isMissingColumn(error, "status")) return false;

  const fallbackQuery = await context.supabase
    .from("class_teachers")
    .select("id")
    .eq("org_id", context.session.orgId)
    .eq("class_id", classId)
    .eq("teacher_id", context.profileId)
    .is("removed_at", null)
    .maybeSingle();

  return Boolean(fallbackQuery.data);
}

export async function writeAuditLog(
  context: WorkflowContext,
  details: {
    action: string;
    entity?: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await context.supabase.from("audit_logs").insert({
    org_id: context.session.orgId,
    actor_id: context.profileId,
    action: details.action,
    entity: details.entity,
    entity_id: details.entityId ?? null,
    metadata: details.metadata ?? {},
  });

  if (error) {
    console.warn("Audit log skipped", {
      action: details.action,
      entity: details.entity,
      code: error.code,
    });
  }
}

export async function requireClassAccess(
  context: WorkflowContext,
  classId: string | null | undefined,
) {
  if (!classId) return null;

  const { data, error } = await context.supabase
    .from("classes")
    .select("id,name,teacher_id")
    .eq("id", classId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (error) return jsonError("Unable to verify class access.", 500);
  if (!data) return jsonError("Class was not found.", 404);

  if (
    !canManageTeacherOwnedRecord({
      role: context.session.role,
      profileId: context.profileId,
      ownerId: data.teacher_id,
    }) &&
    !(await hasClassTeacherAccess(context, data.id))
  ) {
    return jsonError("You do not have access to this class.", 403);
  }

  return data as { id: string; name: string; teacher_id: string | null };
}

export async function requireResourceAccess(
  context: WorkflowContext,
  resourceId: string,
) {
  const { data, error } = await context.supabase
    .from("resources")
    .select("id,title,teacher_id,class_id,file_path")
    .eq("id", resourceId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (error) return jsonError("Unable to verify resource access.", 500);
  if (!data) return jsonError("Resource was not found.", 404);

  if (
    !canManageTeacherOwnedRecord({
      role: context.session.role,
      profileId: context.profileId,
      ownerId: data.teacher_id,
    }) &&
    !(await hasClassTeacherAccess(context, data.class_id as string))
  ) {
    return jsonError("You do not have access to this resource.", 403);
  }

  return data as {
    id: string;
    title: string;
    teacher_id: string | null;
    class_id: string | null;
    file_path: string | null;
  };
}

export async function requireAssignmentAccess(
  context: WorkflowContext,
  assignmentId: string,
) {
  const { data, error } = await context.supabase
    .from("assignments")
    .select("id,title,class_id,teacher_id,points")
    .eq("id", assignmentId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (error) return jsonError("Unable to verify assignment access.", 500);
  if (!data) return jsonError("Assignment was not found.", 404);

  if (
    !canManageTeacherOwnedRecord({
      role: context.session.role,
      profileId: context.profileId,
      ownerId: data.teacher_id,
    }) &&
    !(await hasClassTeacherAccess(context, data.class_id as string))
  ) {
    return jsonError("You do not have access to this assignment.", 403);
  }

  return data as {
    id: string;
    title: string;
    class_id: string;
    teacher_id: string;
    points: number;
  };
}

export async function requireSubmissionAccess(
  context: WorkflowContext,
  submissionId: string,
) {
  const { data, error } = await context.supabase
    .from("submissions")
    .select(
      "id,student_id,assignment_id,assignments(id,title,class_id,teacher_id,points)",
    )
    .eq("id", submissionId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (error) return jsonError("Unable to verify submission access.", 500);
  if (!data) return jsonError("Submission was not found.", 404);

  const assignment = Array.isArray(data.assignments)
    ? data.assignments[0]
    : data.assignments;

  if (
    !canManageTeacherOwnedRecord({
      role: context.session.role,
      profileId: context.profileId,
      ownerId: assignment?.teacher_id,
    }) &&
    !(await hasClassTeacherAccess(
      context,
      (assignment as { class_id?: string } | undefined)?.class_id,
    ))
  ) {
    return jsonError("You do not have access to this submission.", 403);
  }

  return {
    id: data.id as string,
    studentId: data.student_id as string,
    assignmentId: data.assignment_id as string,
    assignment: assignment as
      | {
          id: string;
          title: string;
          class_id: string;
          teacher_id: string;
          points: number;
        }
      | undefined,
  };
}

export async function requireAnnouncementAccess(
  context: WorkflowContext,
  announcementId: string,
) {
  const { data, error } = await context.supabase
    .from("announcements")
    .select("id,class_id,created_by")
    .eq("id", announcementId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (error) return jsonError("Unable to verify announcement access.", 500);
  if (!data) return jsonError("Announcement was not found.", 404);

  let classOwnerId: string | null = null;
  if (data.class_id) {
    const { data: classRecord } = await context.supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", data.class_id)
      .eq("org_id", context.session.orgId)
      .maybeSingle();
    classOwnerId =
      classRecord && typeof classRecord.teacher_id === "string"
        ? classRecord.teacher_id
        : null;
  }
  const canEdit =
    canManageTeacherOwnedRecord({
      role: context.session.role,
      profileId: context.profileId,
      ownerId: data.created_by,
    }) ||
    canManageTeacherOwnedRecord({
      role: context.session.role,
      profileId: context.profileId,
      ownerId: classOwnerId,
    }) ||
    (await hasClassTeacherAccess(context, data.class_id as string));

  if (!canEdit) {
    return jsonError("You do not have access to this announcement.", 403);
  }

  return data as { id: string; class_id: string | null; created_by: string };
}

export async function requireCalendarAccess(
  context: WorkflowContext,
  eventId: string,
) {
  const { data, error } = await context.supabase
    .from("calendar_events")
    .select("id,class_id,owner_id")
    .eq("id", eventId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (error) return jsonError("Unable to verify calendar access.", 500);
  if (!data) return jsonError("Calendar event was not found.", 404);

  if (
    !canManageTeacherOwnedRecord({
      role: context.session.role,
      profileId: context.profileId,
      ownerId: data.owner_id,
    })
  ) {
    return jsonError("You do not have access to this calendar event.", 403);
  }

  return data as { id: string; class_id: string | null; owner_id: string };
}
