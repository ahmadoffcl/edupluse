import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { isAdminRole } from "@/lib/server/workflow-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type DbRecord = Record<string, unknown>;

export type AdminTimetableImport = {
  id: string;
  originalFilename: string;
  status: string;
  timezone: string;
  effectiveFrom: string | null;
  detectedSections: unknown[];
  createdAt: string;
  publishedAt: string | null;
};

export type AdminTimetableSlot = {
  id: string;
  importId: string;
  classId: string | null;
  sectionKey: string;
  sectionLabel: string;
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  subjectName: string;
  teacherName: string | null;
  venue: string | null;
  active: boolean;
  confidence: number;
  reviewStatus: string;
};

export type AdminTimetableClass = {
  id: string;
  name: string;
  section: string | null;
  meta: string;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function boolValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function getAdminTimetableData() {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !isAdminRole(session.role) || !supabase) {
    return { imports: [], slots: [], classes: [] };
  }

  const [importsResult, classesResult] = await Promise.all([
    supabase
      .from("timetable_imports")
      .select(
        "id,original_filename,status,timezone,effective_from,detected_sections,created_at,published_at",
      )
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("classes")
      .select("id,name,section,grade_level,batch,term")
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const imports = ((importsResult.data ?? []) as DbRecord[]).map((row) => ({
    id: stringValue(row.id),
    originalFilename: stringValue(row.original_filename, "Timetable PDF"),
    status: stringValue(row.status, "draft"),
    timezone: stringValue(row.timezone, "Asia/Karachi"),
    effectiveFrom: stringValue(row.effective_from) || null,
    detectedSections: asArray(row.detected_sections),
    createdAt: stringValue(row.created_at),
    publishedAt: stringValue(row.published_at) || null,
  }));

  const activeImportId = imports[0]?.id;
  const slotsResult = activeImportId
    ? await supabase
        .from("timetable_slots")
        .select(
          "id,import_id,class_id,section_key,section_label,day_of_week,start_time,end_time,subject_name,teacher_name,venue,active,confidence,review_status",
        )
        .eq("org_id", session.orgId)
        .eq("import_id", activeImportId)
        .order("section_key", { ascending: true })
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1000)
    : { data: [], error: null };

  const slots = ((slotsResult.data ?? []) as DbRecord[]).map((row) => ({
    id: stringValue(row.id),
    importId: stringValue(row.import_id),
    classId: stringValue(row.class_id) || null,
    sectionKey: stringValue(row.section_key),
    sectionLabel: stringValue(row.section_label),
    dayOfWeek: numberValue(row.day_of_week, 1),
    startTime: stringValue(row.start_time).slice(0, 5) || null,
    endTime: stringValue(row.end_time).slice(0, 5) || null,
    subjectName: stringValue(row.subject_name, "Class"),
    teacherName: stringValue(row.teacher_name) || null,
    venue: stringValue(row.venue) || null,
    active: boolValue(row.active, true),
    confidence: numberValue(row.confidence, 0.5),
    reviewStatus: stringValue(row.review_status, "needs_review"),
  }));

  const classes = ((classesResult.data ?? []) as DbRecord[]).map((row) => {
    const meta = [row.grade_level, row.batch, row.term, row.section && `Sec ${row.section}`]
      .map((value) => stringValue(value))
      .filter(Boolean)
      .join(" - ");

    return {
      id: stringValue(row.id),
      name: stringValue(row.name, "Classroom"),
      section: stringValue(row.section) || null,
      meta,
    };
  });

  return { imports, slots, classes };
}
