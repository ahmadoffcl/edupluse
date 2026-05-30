import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { isAdminRole } from "@/lib/server/workflow-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type DbRecord = Record<string, unknown>;

export type AdminClassRow = {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  section: string | null;
  gradeLevel: string | null;
  batch: string | null;
  term: string | null;
  deliveryMode: string;
  capacity: number | null;
  scheduleNote: string | null;
  teacherId: string | null;
  teacherName: string | null;
  archivedAt: string | null;
  studentCount: number;
  assignmentCount: number;
  materialCount: number;
};

export type AdminTeacherOption = {
  id: string;
  name: string;
  email: string | null;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

function relation(value: unknown) {
  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

function relationRows(value: unknown) {
  return Array.isArray(value) ? (value as DbRecord[]) : [];
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

async function loadClassRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  orgId: string,
) {
  const selects = [
    "id,name,description,banner_url,section,grade_level,batch,term,delivery_mode,capacity,schedule_note,teacher_id,archived_at,created_at",
    "id,name,description,banner_url,section,grade_level,batch,term,delivery_mode,capacity,teacher_id,archived_at,created_at",
    "id,name,section,grade_level,batch,term,delivery_mode,teacher_id,archived_at,created_at",
    "id,name,section,grade_level,batch,term,delivery_mode,teacher_id,created_at",
    "id,name,section,grade_level,batch,term,teacher_id,created_at",
  ];

  for (const select of selects) {
    const result = await supabase
      .from("classes")
      .select(select)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!result.error) return (result.data ?? []) as unknown as DbRecord[];

    const canRetry =
      isMissingColumn(result.error, "description") ||
      isMissingColumn(result.error, "banner_url") ||
      isMissingColumn(result.error, "capacity") ||
      isMissingColumn(result.error, "schedule_note") ||
      isMissingColumn(result.error, "archived_at") ||
      isMissingColumn(result.error, "delivery_mode");

    if (!canRetry) {
      console.warn("Admin classes query failed", {
        code: result.error.code,
        message: result.error.message,
      });
      return [];
    }
  }

  return [];
}

async function countByClass(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  table: string,
  orgId: string,
  classIds: string[],
) {
  if (classIds.length === 0) return new Map<string, number>();
  const { data, error } = await supabase
    .from(table)
    .select("class_id")
    .eq("org_id", orgId)
    .in("class_id", classIds)
    .limit(10000);

  const counts = new Map<string, number>();
  if (error) return counts;
  for (const row of (data ?? []) as unknown as DbRecord[]) {
    const classId = stringValue(row.class_id);
    if (!classId) continue;
    counts.set(classId, (counts.get(classId) ?? 0) + 1);
  }

  return counts;
}

export async function getAdminClassesData(): Promise<{
  classes: AdminClassRow[];
  teachers: AdminTeacherOption[];
}> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !isAdminRole(session.role) || !supabase) {
    return { classes: [], teachers: [] };
  }

  const [classRows, teachersResult] = await Promise.all([
    loadClassRows(supabase, session.orgId),
    supabase
      .from("memberships")
      .select("profiles(id,display_name,email),role,status")
      .eq("org_id", session.orgId)
      .in("role", ["teacher", "admin", "super_admin"])
      .eq("status", "active")
      .limit(1000),
  ]);

  const classIds = classRows.map((row) => stringValue(row.id)).filter(Boolean);
  const teacherIds = Array.from(
    new Set(
      classRows.map((row) => stringValue(row.teacher_id)).filter(Boolean),
    ),
  );

  const [
    teacherProfilesResult,
    studentCounts,
    assignmentCounts,
    materialCounts,
  ] = await Promise.all([
    teacherIds.length
      ? supabase
          .from("profiles")
          .select("id,display_name")
          .in("id", teacherIds)
          .limit(1000)
      : { data: [], error: null },
    countByClass(supabase, "enrollments", session.orgId, classIds),
    countByClass(supabase, "assignments", session.orgId, classIds),
    countByClass(supabase, "resources", session.orgId, classIds),
  ]);

  const teachersById = new Map(
    ((teacherProfilesResult.data ?? []) as DbRecord[]).map((row) => [
      stringValue(row.id),
      stringValue(row.display_name),
    ]),
  );

  const classes = classRows.map((row) => {
    const classId = stringValue(row.id);
    return {
      id: classId,
      name: stringValue(row.name, "Classroom"),
      description: stringValue(row.description) || null,
      bannerUrl: stringValue(row.banner_url) || null,
      section: stringValue(row.section) || null,
      gradeLevel: stringValue(row.grade_level) || null,
      batch: stringValue(row.batch) || null,
      term: stringValue(row.term) || null,
      deliveryMode: stringValue(row.delivery_mode, "hybrid"),
      capacity: numberOrNull(row.capacity),
      scheduleNote: stringValue(row.schedule_note) || null,
      teacherId: stringValue(row.teacher_id) || null,
      teacherName: teachersById.get(stringValue(row.teacher_id)) || null,
      archivedAt: stringValue(row.archived_at) || null,
      studentCount:
        studentCounts.get(classId) ?? relationRows(row.enrollments).length,
      assignmentCount:
        assignmentCounts.get(classId) ?? relationRows(row.assignments).length,
      materialCount:
        materialCounts.get(classId) ?? relationRows(row.resources).length,
    };
  });

  const teachers = ((teachersResult.data ?? []) as DbRecord[])
    .map((row) => {
      const profile = relation(row.profiles);
      return {
        id: stringValue(profile?.id),
        name: stringValue(profile?.display_name, "Teacher"),
        email: stringValue(profile?.email) || null,
      };
    })
    .filter((teacher) => teacher.id);

  return { classes, teachers };
}
