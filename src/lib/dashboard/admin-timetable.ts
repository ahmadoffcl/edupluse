import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { isAdminRole } from "@/lib/server/workflow-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  BUILTIN_TIMETABLE_FILENAME,
  BUILTIN_TIMETABLE_IMPORT_ID,
  loadBuiltInTimetable,
  mapBuiltInSlot,
} from "@/lib/timetable/builtin";
import { TIMETABLE_TIMEZONE } from "@/lib/timetable/types";

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

async function loadClassRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  orgId: string,
) {
  let result = await supabase
    .from("classes")
    .select("id,name,section,grade_level,batch,term")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (result.error) {
    result = await supabase
      .from("classes")
      .select("id,name,section,grade_level,batch,term")
      .eq("org_id", orgId)
      .limit(1000);
  }

  return (result.data ?? []) as DbRecord[];
}

function mapClassRows(rows: DbRecord[]) {
  return rows.map((row) => {
    const meta = [
      row.grade_level,
      row.batch,
      row.term,
      row.section && `Sec ${row.section}`,
    ]
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
}

async function builtInFallback(classes: DbRecord[]) {
  const parsed = await loadBuiltInTimetable();
  if (!parsed) return null;

  const slots = parsed.slots.map((slot) => {
    const row = mapBuiltInSlot(slot, classes, { requireStrongMatch: false });
    return {
      id: stringValue(row.id),
      importId: BUILTIN_TIMETABLE_IMPORT_ID,
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
    };
  });

  return {
    imports: [
      {
        id: BUILTIN_TIMETABLE_IMPORT_ID,
        originalFilename: BUILTIN_TIMETABLE_FILENAME,
        status: "draft",
        timezone: TIMETABLE_TIMEZONE,
        effectiveFrom:
          parsed.sections.find((section) => section.effectiveFrom)
            ?.effectiveFrom ?? null,
        detectedSections: parsed.sections,
        createdAt: new Date().toISOString(),
        publishedAt: null,
      },
    ],
    slots,
  };
}

export async function getAdminTimetableData() {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !isAdminRole(session.role) || !supabase) {
    return { imports: [], slots: [], classes: [] };
  }

  const [importsResult, classRows] = await Promise.all([
    supabase
      .from("timetable_imports")
      .select(
        "id,original_filename,status,timezone,effective_from,detected_sections,created_at,published_at",
      )
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(20),
    loadClassRows(supabase, session.orgId),
  ]);

  const classes = mapClassRows(classRows);

  if (
    importsResult.error &&
    isMissingRelation(importsResult.error, "timetable_imports")
  ) {
    const fallback = await builtInFallback(classRows);
    return fallback
      ? { ...fallback, classes }
      : { imports: [], slots: [], classes };
  }

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

  if (imports.length === 0) {
    const fallback = await builtInFallback(classRows);
    return fallback
      ? { ...fallback, classes }
      : { imports: [], slots: [], classes };
  }

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

  if (
    slotsResult.error &&
    isMissingRelation(slotsResult.error, "timetable_slots")
  ) {
    const fallback = await builtInFallback(classRows);
    return fallback
      ? { ...fallback, classes }
      : { imports, slots: [], classes };
  }

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

  return { imports, slots, classes };
}
