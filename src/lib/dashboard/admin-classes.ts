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

export async function getAdminClassesData(): Promise<{
  classes: AdminClassRow[];
  teachers: AdminTeacherOption[];
}> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !isAdminRole(session.role) || !supabase) {
    return { classes: [], teachers: [] };
  }

  const [classesResult, teachersResult] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id,name,description,banner_url,section,grade_level,batch,term,delivery_mode,capacity,schedule_note,teacher_id,archived_at,profiles!classes_teacher_id_fkey(display_name),enrollments(id),assignments(id),resources(id)",
      )
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("memberships")
      .select("profiles(id,display_name,email),role,status")
      .eq("org_id", session.orgId)
      .in("role", ["teacher", "admin", "super_admin"])
      .eq("status", "active")
      .limit(1000),
  ]);

  const classes = ((classesResult.data ?? []) as DbRecord[]).map((row) => {
    const teacher = relation(row.profiles);
    return {
      id: stringValue(row.id),
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
      teacherName: stringValue(teacher?.display_name) || null,
      archivedAt: stringValue(row.archived_at) || null,
      studentCount: relationRows(row.enrollments).length,
      assignmentCount: relationRows(row.assignments).length,
      materialCount: relationRows(row.resources).length,
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
