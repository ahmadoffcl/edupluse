import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { isMissingClassJoinRequestTable } from "@/lib/server/class-join-requests";
import {
  isMissingLearningMissionEventsTable,
  isMissingLearningMissionsTable,
} from "@/lib/dashboard/learning-missions";
import { isTeacherRole } from "@/lib/server/workflow-auth";
import {
  engagementHeavyPerformance,
  performanceBand,
} from "@/lib/server/performance";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  Activity,
  Assignment,
  LeaderboardEntry,
  MessageThread,
  Metric,
  Note,
  Role,
  ScheduleItem,
} from "@/lib/types";

type DbRecord = Record<string, unknown>;

function relation(row: DbRecord, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

function asRows(value: unknown): DbRecord[] {
  return Array.isArray(value) ? (value as DbRecord[]) : [];
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

export type TeacherClassOption = {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  section: string | null;
  gradeLevel: string | null;
  batch: string | null;
  deliveryMode: string;
  term: string | null;
  capacity: number | null;
  scheduleNote: string | null;
  teacherId: string | null;
  isPrimaryTeacher: boolean;
  canApproveTeachers: boolean;
  createdAt: string;
};

export type TeacherSubjectOption = {
  id: string;
  name: string;
  code: string | null;
  classId: string | null;
};

export type TeacherStudentOption = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  classIds: string[];
};

export type TeacherSubmissionRow = {
  id: string;
  assignmentId: string;
  classId: string;
  studentId: string;
  assignmentTitle: string;
  studentName: string;
  status: string;
  score: number | null;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
  content: string | null;
  filePath: string | null;
  signedUrl: string | null;
  mimeType: string | null;
  originalFilename: string | null;
};

export type StudentPerformanceRow = {
  profileId: string;
  name: string;
  username: string | null;
  attendancePercent: number;
  submittedPercent: number;
  averageScore: number;
  xp: number;
  missingCount: number;
  lateCount: number;
  performanceScore: number;
  band: "high_momentum" | "steady" | "watch" | "at_risk";
};

export type TeacherMissionSignalRow = {
  profileId: string;
  classId: string | null;
  openCount: number;
  completedCount: number;
  dismissedCount: number;
  urgentCount: number;
  missedCount: number;
  latestTitle: string | null;
  lastActionAt: string | null;
  lastActionLabel: string | null;
  suggestedFollowUp: string;
};

export type TeacherResourceRow = {
  id: string;
  title: string;
  type: string;
  classId: string | null;
  className: string | null;
  subjectId: string | null;
  subjectName: string | null;
  body: string | null;
  externalUrl: string | null;
  signedUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  originalFilename: string | null;
  createdAt: string;
};

export type TeacherAssignmentRow = {
  id: string;
  title: string;
  classId: string;
  className: string;
  subjectId: string | null;
  subjectName: string | null;
  status: string;
  dueAt: string | null;
  points: number;
  submittedCount: number;
  gradedCount: number;
  totalStudents: number;
  attachments: Array<{
    path: string;
    name: string;
    size: number;
    mimeType: string;
    signedUrl?: string | null;
  }>;
};

export type TeacherAttendanceRow = {
  id: string;
  classId: string;
  className: string;
  studentName: string;
  studentUsername: string | null;
  status: string;
  attendedOn: string;
  note: string | null;
};

export type TeacherAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  classId: string | null;
  className: string | null;
  publishedAt: string | null;
};

export type TeacherCalendarEventRow = {
  id: string;
  title: string;
  kind: string;
  classId: string | null;
  className: string | null;
  startsAt: string;
  endsAt: string | null;
};

export type TeacherClassJoinRequestRow = {
  id: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentUsername: string | null;
  studentEmail: string | null;
  status: string;
  requestedAt: string;
};

export type TeacherClassTeacherRow = {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  teacherUsername: string | null;
  teacherEmail: string | null;
  role: string;
  status: "pending" | "active" | "rejected";
  requestedAt: string | null;
  joinedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  isSelf: boolean;
};

export type TeacherProfileSettings = {
  displayName: string;
  email: string | null;
  username: string | null;
  bio: string | null;
  tagline: string;
  officeHours: string;
  gradingTargetHours: number;
  aiAssistance: boolean;
};

export type TeacherWorkflowData = {
  role: Role | null;
  connected: boolean;
  metrics: Metric[];
  classes: TeacherClassOption[];
  availableStudents: TeacherStudentOption[];
  subjects: TeacherSubjectOption[];
  students: TeacherStudentOption[];
  submissions: TeacherSubmissionRow[];
  performance: StudentPerformanceRow[];
  missionSignals: TeacherMissionSignalRow[];
  resources: TeacherResourceRow[];
  assignmentRows: TeacherAssignmentRow[];
  attendanceHistory: TeacherAttendanceRow[];
  announcements: TeacherAnnouncementRow[];
  calendarEvents: TeacherCalendarEventRow[];
  joinRequests: TeacherClassJoinRequestRow[];
  classTeachers: TeacherClassTeacherRow[];
  pendingTeacherInvites: TeacherClassTeacherRow[];
  profile: TeacherProfileSettings | null;
  notes: Note[];
  assignments: Assignment[];
  schedule: ScheduleItem[];
  messages: MessageThread[];
  leaderboard: LeaderboardEntry[];
  activities: Activity[];
  riskSignals: Array<{
    label: string;
    count: number;
    severity: "high" | "medium";
  }>;
  engagementChart: Array<{ label: string; engagement: number }>;
  attendanceChart: Array<{ label: string; present: number; absent: number }>;
  assignmentStatusChart: Array<{ name: string; value: number }>;
};

function emptyData(): TeacherWorkflowData {
  return {
    role: null,
    connected: false,
    metrics: [],
    classes: [],
    availableStudents: [],
    subjects: [],
    students: [],
    submissions: [],
    performance: [],
    missionSignals: [],
    resources: [],
    assignmentRows: [],
    attendanceHistory: [],
    announcements: [],
    calendarEvents: [],
    joinRequests: [],
    classTeachers: [],
    pendingTeacherInvites: [],
    profile: null,
    notes: [],
    assignments: [],
    schedule: [],
    messages: [],
    leaderboard: [],
    activities: [],
    riskSignals: [],
    engagementChart: [],
    attendanceChart: [],
    assignmentStatusChart: [],
  };
}

export async function getTeacherWorkflowData(): Promise<TeacherWorkflowData> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !isTeacherRole(session.role) || !supabase) {
    return emptyData();
  }

  const currentSession = session;
  const db = supabase;

  let teacherProfileResult = await db
    .from("profiles")
    .select("id,display_name,email,username,bio,teacher_settings")
    .eq("firebase_uid", currentSession.uid)
    .maybeSingle();

  if (
    teacherProfileResult.error &&
    (isMissingColumn(teacherProfileResult.error, "username") ||
      isMissingColumn(teacherProfileResult.error, "bio") ||
      isMissingColumn(teacherProfileResult.error, "teacher_settings"))
  ) {
    teacherProfileResult = await db
      .from("profiles")
      .select("id,display_name,email")
      .eq("firebase_uid", currentSession.uid)
      .maybeSingle();
  }

  const teacherProfile = teacherProfileResult.data;
  const teacherProfileRecord = (teacherProfile ?? null) as DbRecord | null;
  const teacherProfileId = stringValue(teacherProfileRecord?.id);
  const teacherSettings =
    teacherProfileRecord?.teacher_settings &&
    typeof teacherProfileRecord.teacher_settings === "object"
      ? (teacherProfileRecord.teacher_settings as DbRecord)
      : {};

  const canSeeAllClasses = currentSession.role !== "teacher";
  let coTeacherClassIds: string[] = [];
  if (currentSession.role === "teacher" && teacherProfileId) {
    let coTeacherResult = await db
      .from("class_teachers")
      .select("class_id")
      .eq("org_id", currentSession.orgId)
      .eq("teacher_id", teacherProfileId)
      .eq("status", "active")
      .is("removed_at", null)
      .limit(1000);

    if (coTeacherResult.error && isMissingColumn(coTeacherResult.error, "status")) {
      coTeacherResult = await db
        .from("class_teachers")
        .select("class_id")
        .eq("org_id", currentSession.orgId)
        .eq("teacher_id", teacherProfileId)
        .is("removed_at", null)
        .limit(1000);
    }

    if (!coTeacherResult.error) {
      coTeacherClassIds = ((coTeacherResult.data ?? []) as DbRecord[])
        .map((row) => stringValue(row.class_id))
        .filter(Boolean);
    } else if (!isMissingRelation(coTeacherResult.error, "class_teachers")) {
      coTeacherClassIds = [];
    }
  }

  async function loadClasses(select: string, activeOnly = true) {
    function baseQuery() {
      const query = db
        .from("classes")
        .select(select)
        .eq("org_id", currentSession.orgId);

      if (activeOnly) {
        query.is("archived_at", null);
      }

      return query.order("created_at", { ascending: false }).limit(100);
    }

    if (currentSession.role === "teacher" && teacherProfileId) {
      const ownerResult = await baseQuery().eq("teacher_id", teacherProfileId);
      if (ownerResult.error) return ownerResult;
      if (coTeacherClassIds.length === 0) return ownerResult;

      const coTeacherResult = await baseQuery().in("id", coTeacherClassIds);
      if (coTeacherResult.error) return ownerResult;

      const byId = new Map<string, DbRecord>();
      for (const row of (ownerResult.data ?? []) as unknown as DbRecord[]) {
        byId.set(stringValue(row.id), row);
      }
      for (const row of (coTeacherResult.data ?? []) as unknown as DbRecord[]) {
        byId.set(stringValue(row.id), row);
      }

      return { data: Array.from(byId.values()), error: null };
    }

    return await baseQuery();
  }

  let classesResult = await loadClasses(
    "id,name,description,banner_url,section,grade_level,batch,delivery_mode,term,capacity,schedule_note,teacher_id,created_at",
  );

  if (
    classesResult.error &&
    (isMissingColumn(classesResult.error, "description") ||
      isMissingColumn(classesResult.error, "banner_url"))
  ) {
    classesResult = await loadClasses(
      "id,name,section,grade_level,batch,delivery_mode,term,capacity,schedule_note,teacher_id,created_at",
    );
  }

  if (
    classesResult.error &&
    isMissingColumn(classesResult.error, "archived_at")
  ) {
    classesResult = await loadClasses(
      "id,name,description,banner_url,section,grade_level,batch,delivery_mode,term,capacity,schedule_note,teacher_id,created_at",
      false,
    );

    if (
      classesResult.error &&
      (isMissingColumn(classesResult.error, "description") ||
        isMissingColumn(classesResult.error, "banner_url"))
    ) {
      classesResult = await loadClasses(
        "id,name,section,grade_level,batch,delivery_mode,term,capacity,schedule_note,teacher_id,created_at",
        false,
      );
    }
  }

  if (classesResult.error) return emptyData();

  const classes = ((classesResult.data ?? []) as unknown as DbRecord[]).map(
    (row) => ({
      id: stringValue(row.id),
      name: stringValue(row.name),
      description: stringValue(row.description) || null,
      bannerUrl: stringValue(row.banner_url) || null,
      section: stringValue(row.section) || null,
      gradeLevel: stringValue(row.grade_level) || null,
      batch: stringValue(row.batch) || null,
      deliveryMode: stringValue(row.delivery_mode, "hybrid"),
      term: stringValue(row.term) || null,
      capacity:
        typeof row.capacity === "number" ? numberValue(row.capacity) : null,
      scheduleNote: stringValue(row.schedule_note) || null,
      teacherId: stringValue(row.teacher_id) || null,
      isPrimaryTeacher: stringValue(row.teacher_id) === teacherProfileId,
      canApproveTeachers:
        currentSession.role !== "teacher" ||
        stringValue(row.teacher_id) === teacherProfileId,
      createdAt: stringValue(row.created_at),
    }),
  );
  const visibleClassIds = new Set(classes.map((item) => item.id));
  const classById = new Map(
    classes.map((classRecord) => [classRecord.id, classRecord]),
  );

  let rawClassTeacherRows: DbRecord[] = [];
  let classTeachersData: unknown[] | null = null;
  let classTeachersError: unknown = null;
  const classTeachersWithStatusResult = await db
    .from("class_teachers")
    .select(
      "id,class_id,teacher_id,role,status,requested_at,joined_at,approved_at,rejected_at,removed_at",
    )
    .eq("org_id", currentSession.orgId)
    .is("removed_at", null)
    .limit(1000);

  if (
    classTeachersWithStatusResult.error &&
    isMissingColumn(classTeachersWithStatusResult.error, "status")
  ) {
    const fallbackClassTeachersResult = await db
      .from("class_teachers")
      .select("id,class_id,teacher_id,role,joined_at,removed_at")
      .eq("org_id", currentSession.orgId)
      .is("removed_at", null)
      .limit(1000);
    classTeachersData = fallbackClassTeachersResult.data;
    classTeachersError = fallbackClassTeachersResult.error;
  } else {
    classTeachersData = classTeachersWithStatusResult.data;
    classTeachersError = classTeachersWithStatusResult.error;
  }

  if (
    !classTeachersError ||
    isMissingRelation(classTeachersError, "class_teachers")
  ) {
    rawClassTeacherRows = ((classTeachersData ?? []) as DbRecord[]).filter(
      (row) => {
        const classId = stringValue(row.class_id);
        const teacherId = stringValue(row.teacher_id);
        return (
          canSeeAllClasses ||
          visibleClassIds.has(classId) ||
          teacherId === teacherProfileId
        );
      },
    );
  }

  const classTeacherProfileIds = Array.from(
    new Set(
      rawClassTeacherRows
        .map((row) => stringValue(row.teacher_id))
        .filter(Boolean),
    ),
  );
  let classTeacherProfiles: DbRecord[] = [];
  if (classTeacherProfileIds.length > 0) {
    let profilesData: unknown[] | null = null;
    let profilesError: unknown = null;
    const profilesWithUsernameResult = await db
      .from("profiles")
      .select("id,display_name,email,username")
      .in("id", classTeacherProfileIds)
      .limit(1000);

    if (
      profilesWithUsernameResult.error &&
      isMissingColumn(profilesWithUsernameResult.error, "username")
    ) {
      const fallbackProfilesResult = await db
        .from("profiles")
        .select("id,display_name,email")
        .in("id", classTeacherProfileIds)
        .limit(1000);
      profilesData = fallbackProfilesResult.data;
      profilesError = fallbackProfilesResult.error;
    } else {
      profilesData = profilesWithUsernameResult.data;
      profilesError = profilesWithUsernameResult.error;
    }

    if (!profilesError) {
      classTeacherProfiles = (profilesData ?? []) as DbRecord[];
    }
  }
  const classTeacherProfileById = new Map(
    classTeacherProfiles.map((profile) => [stringValue(profile.id), profile]),
  );

  const pendingSelfClassIds = rawClassTeacherRows
    .filter(
      (row) =>
        stringValue(row.teacher_id) === teacherProfileId &&
        stringValue(row.status, "active") === "pending" &&
        !classById.has(stringValue(row.class_id)),
    )
    .map((row) => stringValue(row.class_id))
    .filter(Boolean);
  if (pendingSelfClassIds.length > 0) {
    const { data: pendingClasses } = await db
      .from("classes")
      .select("id,name,section,teacher_id")
      .eq("org_id", currentSession.orgId)
      .in("id", Array.from(new Set(pendingSelfClassIds)))
      .limit(1000);

    for (const row of (pendingClasses ?? []) as DbRecord[]) {
      classById.set(stringValue(row.id), {
        id: stringValue(row.id),
        name: stringValue(row.name, "Classroom"),
        description: null,
        bannerUrl: null,
        section: stringValue(row.section) || null,
        gradeLevel: null,
        batch: null,
        deliveryMode: "hybrid",
        term: null,
        capacity: null,
        scheduleNote: null,
        teacherId: stringValue(row.teacher_id) || null,
        isPrimaryTeacher: false,
        canApproveTeachers: false,
        createdAt: "",
      });
    }
  }

  const classTeachers: TeacherClassTeacherRow[] = rawClassTeacherRows.map(
    (row) => {
      const teacherId = stringValue(row.teacher_id);
      const profile = classTeacherProfileById.get(teacherId);
      const status = stringValue(row.status, "active");
      return {
        id: stringValue(row.id),
        classId: stringValue(row.class_id),
        className:
          classById.get(stringValue(row.class_id))?.name ?? "Classroom",
        teacherId,
        teacherName: stringValue(profile?.display_name, "Teacher"),
        teacherUsername: stringValue(profile?.username) || null,
        teacherEmail: stringValue(profile?.email) || null,
        role: stringValue(row.role, "co_teacher"),
        status:
          status === "pending" || status === "rejected"
            ? status
            : "active",
        requestedAt: stringValue(row.requested_at) || null,
        joinedAt: stringValue(row.joined_at) || null,
        approvedAt: stringValue(row.approved_at) || null,
        rejectedAt: stringValue(row.rejected_at) || null,
        isSelf: teacherId === teacherProfileId,
      };
    },
  );
  const pendingTeacherInvites = classTeachers.filter(
    (teacher) => teacher.isSelf && teacher.status === "pending",
  );

  const availableStudentsResult = await db
    .from("memberships")
    .select(
      "profile_id,profiles!memberships_profile_id_fkey(id,display_name,username,email)",
    )
    .eq("org_id", currentSession.orgId)
    .eq("role", "student")
    .eq("status", "active")
    .limit(1000);

  let availableStudentRows = !availableStudentsResult.error
    ? ((availableStudentsResult.data ?? []) as unknown as DbRecord[])
    : [];

  if (
    availableStudentsResult.error &&
    isMissingColumn(availableStudentsResult.error, "username")
  ) {
    const fallbackAvailableStudentsResult = await db
      .from("memberships")
      .select(
        "profile_id,profiles!memberships_profile_id_fkey(id,display_name,email)",
      )
      .eq("org_id", currentSession.orgId)
      .eq("role", "student")
      .eq("status", "active")
      .limit(1000);

    if (!fallbackAvailableStudentsResult.error) {
      availableStudentRows = (fallbackAvailableStudentsResult.data ??
        []) as unknown as DbRecord[];
    }
  }

  const enrollmentsResult = await db
    .from("enrollments")
    .select(
      "class_id,profiles!enrollments_student_id_fkey(id,display_name,username,email)",
    )
    .eq("org_id", currentSession.orgId)
    .limit(1000);

  let enrollmentRows = !enrollmentsResult.error
    ? ((enrollmentsResult.data ?? []) as unknown as DbRecord[])
    : [];

  if (
    enrollmentsResult.error &&
    isMissingColumn(enrollmentsResult.error, "username")
  ) {
    const fallbackEnrollmentsResult = await db
      .from("enrollments")
      .select(
        "class_id,profiles!enrollments_student_id_fkey(id,display_name,email)",
      )
      .eq("org_id", currentSession.orgId)
      .limit(1000);

    if (!fallbackEnrollmentsResult.error) {
      enrollmentRows = (fallbackEnrollmentsResult.data ??
        []) as unknown as DbRecord[];
    }
  }

  async function loadAssignments(select: string) {
    return await db
      .from("assignments")
      .select(select)
      .eq("org_id", currentSession.orgId)
      .limit(300);
  }

  let assignmentsResult = await loadAssignments(
    "id,title,class_id,subject_id,due_at,status,points,attachments,created_at,published_at,closed_at,classes(name,section),subjects(name),submissions(id,student_id,status,score)",
  );

  if (
    assignmentsResult.error &&
    isMissingColumn(assignmentsResult.error, "attachments")
  ) {
    assignmentsResult = await loadAssignments(
      "id,title,class_id,subject_id,due_at,status,points,created_at,published_at,closed_at,classes(name,section),subjects(name),submissions(id,student_id,status,score)",
    );
  }

  const [
    subjectsResult,
    attendanceResult,
    submissionsResult,
    xpResult,
    resourcesResult,
    eventsResult,
    announcementsResult,
    messagesResult,
    joinRequestsResult,
    missionSignalsResult,
    missionEventsResult,
  ] = await Promise.all([
    db
      .from("subjects")
      .select("id,name,code,class_id")
      .eq("org_id", currentSession.orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("attendance_records")
      .select(
        "id,class_id,student_id,status,attended_on,note,classes(name),profiles!attendance_records_student_id_fkey(display_name,username)",
      )
      .eq("org_id", currentSession.orgId)
      .order("attended_on", { ascending: false })
      .limit(2000),
    db
      .from("submissions")
      .select(
        "id,assignment_id,student_id,status,score,feedback,submitted_at,graded_at,file_path,content,file_size,mime_type,original_filename,assignments(id,title,class_id,points),profiles(display_name,username,email)",
      )
      .eq("org_id", currentSession.orgId)
      .order("submitted_at", { ascending: false })
      .limit(200),
    db
      .from("gamification_events")
      .select("profile_id,xp,created_at")
      .eq("org_id", currentSession.orgId)
      .limit(1000),
    db
      .from("resources")
      .select(
        "id,title,type,body,file_path,external_url,file_size,mime_type,original_filename,class_id,subject_id,created_at,classes(name),subjects(name)",
      )
      .eq("org_id", currentSession.orgId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(120),
    db
      .from("calendar_events")
      .select("id,title,kind,starts_at,ends_at,class_id,classes(name)")
      .eq("org_id", currentSession.orgId)
      .is("archived_at", null)
      .order("starts_at", { ascending: true })
      .limit(120),
    db
      .from("announcements")
      .select("id,title,body,published_at,class_id,classes(name)")
      .eq("org_id", currentSession.orgId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(80),
    db
      .from("messages")
      .select(
        "id,body,created_at,message_threads(title,kind,class_id),profiles(display_name,username)",
      )
      .eq("org_id", currentSession.orgId)
      .order("created_at", { ascending: false })
      .limit(80),
    db
      .from("class_join_requests")
      .select("id,class_id,student_id,status,requested_at")
      .eq("org_id", currentSession.orgId)
      .order("requested_at", { ascending: false })
      .limit(300),
    db
      .from("learning_missions")
      .select(
        "id,profile_id,class_id,source_key,kind,status,priority,title,completed_at,updated_at,last_seen_at",
      )
      .eq("org_id", currentSession.orgId)
      .limit(1000),
    db
      .from("learning_mission_events")
      .select("id,profile_id,class_id,event_type,title,created_at,metadata")
      .eq("org_id", currentSession.orgId)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const subjects = ((subjectsResult.data ?? []) as DbRecord[])
    .filter((row) => {
      const classId = stringValue(row.class_id);
      return canSeeAllClasses || (classId && visibleClassIds.has(classId));
    })
    .map((row) => ({
      id: stringValue(row.id),
      name: stringValue(row.name),
      code: stringValue(row.code) || null,
      classId: stringValue(row.class_id) || null,
    }));

  const studentMap = new Map<string, TeacherStudentOption>();
  const enrollmentsByClass = new Map<string, number>();
  for (const row of enrollmentRows) {
    const classId = stringValue(row.class_id);
    if (!canSeeAllClasses && !visibleClassIds.has(classId)) continue;

    enrollmentsByClass.set(classId, (enrollmentsByClass.get(classId) ?? 0) + 1);
    const profile = relation(row, "profiles");
    const id = stringValue(profile?.id);
    if (!id) continue;

    const current = studentMap.get(id);
    if (current) {
      if (!current.classIds.includes(classId)) current.classIds.push(classId);
      continue;
    }

    studentMap.set(id, {
      id,
      name: stringValue(profile?.display_name, "Unnamed student"),
      username: stringValue(profile?.username) || null,
      email: stringValue(profile?.email) || null,
      classIds: [classId],
    });
  }
  const students = Array.from(studentMap.values());
  const availableStudents = availableStudentRows
    .map((row) => {
      const profile = relation(row, "profiles");
      const id = stringValue(profile?.id) || stringValue(row.profile_id);
      return {
        id,
        name: stringValue(profile?.display_name, "Unnamed student"),
        username: stringValue(profile?.username) || null,
        email: stringValue(profile?.email) || null,
        classIds: studentMap.get(id)?.classIds ?? [],
      };
    })
    .filter((student) => Boolean(student.id));

  const filterByVisibleClass = (row: DbRecord, key = "class_id") => {
    const classId = stringValue(row[key]);
    return canSeeAllClasses || visibleClassIds.has(classId);
  };

  const assignmentRowsRaw = (
    (assignmentsResult.data ?? []) as unknown as DbRecord[]
  ).filter((row) => filterByVisibleClass(row));
  const attendanceRowsRaw = (
    (attendanceResult.data ?? []) as unknown as DbRecord[]
  ).filter((row) => filterByVisibleClass(row));
  const submissionsRaw = (
    (submissionsResult.data ?? []) as unknown as DbRecord[]
  ).filter((row) => {
    const assignment = relation(row, "assignments");
    return (
      canSeeAllClasses || visibleClassIds.has(stringValue(assignment?.class_id))
    );
  });
  const xpRows = (xpResult.data ?? []) as unknown as DbRecord[];
  const resourceRowsRaw = (
    (resourcesResult.data ?? []) as unknown as DbRecord[]
  ).filter((row) => filterByVisibleClass(row) || !stringValue(row.class_id));
  const eventRowsRaw = (
    (eventsResult.data ?? []) as unknown as DbRecord[]
  ).filter((row) => filterByVisibleClass(row) || !stringValue(row.class_id));
  const announcementRowsRaw = (
    (announcementsResult.data ?? []) as unknown as DbRecord[]
  ).filter((row) => filterByVisibleClass(row) || !stringValue(row.class_id));
  const messageRowsRaw = ((messagesResult.data ?? []) as DbRecord[]).filter(
    (row) => {
      const thread = relation(row, "message_threads");
      const classId = stringValue(thread?.class_id);
      return canSeeAllClasses || visibleClassIds.has(classId);
    },
  );
  const joinRequestRowsRaw =
    !joinRequestsResult.error ||
    isMissingClassJoinRequestTable(joinRequestsResult.error)
      ? (((joinRequestsResult.data ?? []) as DbRecord[]).filter((row) =>
          filterByVisibleClass(row),
        ) as DbRecord[])
      : [];
  const missionRowsRaw =
    !missionSignalsResult.error ||
    isMissingLearningMissionsTable(missionSignalsResult.error)
      ? (((missionSignalsResult.data ?? []) as DbRecord[]).filter(
          (row) => filterByVisibleClass(row) || !stringValue(row.class_id),
        ) as DbRecord[])
      : [];
  const missionEventRowsRaw =
    !missionEventsResult.error ||
    isMissingLearningMissionEventsTable(missionEventsResult.error)
      ? (((missionEventsResult.data ?? []) as DbRecord[]).filter(
          (row) => filterByVisibleClass(row) || !stringValue(row.class_id),
        ) as DbRecord[])
      : [];

  const signedUrls = await Promise.all(
    resourceRowsRaw.map(async (row) => {
      const filePath = stringValue(row.file_path);
      if (!filePath) return null;
      const { data } = await db.storage
        .from("resources")
        .createSignedUrl(filePath, 60 * 10);
      return data?.signedUrl ?? null;
    }),
  );
  const submissionSignedUrls = await Promise.all(
    submissionsRaw.map(async (row) => {
      const filePath = stringValue(row.file_path);
      if (!filePath) return null;
      const { data } = await db.storage
        .from("submissions")
        .createSignedUrl(filePath, 60 * 10);
      return data?.signedUrl ?? null;
    }),
  );
  const attachmentUrlMap = new Map<string, string>();
  await Promise.all(
    assignmentRowsRaw.flatMap((row) =>
      asRows(row.attachments).map(async (attachment) => {
        const path = stringValue(attachment.path);
        if (!path) return;
        const { data } = await db.storage
          .from("resources")
          .createSignedUrl(path, 60 * 10);
        if (data?.signedUrl) attachmentUrlMap.set(path, data.signedUrl);
      }),
    ),
  );

  const resources: TeacherResourceRow[] = resourceRowsRaw.map((row, index) => {
    const classRecord = relation(row, "classes");
    const subject = relation(row, "subjects");
    return {
      id: stringValue(row.id),
      title: stringValue(row.title, "Untitled resource"),
      type: stringValue(row.type, "rich_note"),
      classId: stringValue(row.class_id) || null,
      className: stringValue(classRecord?.name) || null,
      subjectId: stringValue(row.subject_id) || null,
      subjectName: stringValue(subject?.name) || null,
      body: stringValue(row.body) || null,
      externalUrl: stringValue(row.external_url) || null,
      signedUrl: signedUrls[index],
      fileSize:
        typeof row.file_size === "number" ? numberValue(row.file_size) : null,
      mimeType: stringValue(row.mime_type) || null,
      originalFilename: stringValue(row.original_filename) || null,
      createdAt: stringValue(row.created_at),
    };
  });

  const assignmentRows: TeacherAssignmentRow[] = assignmentRowsRaw.map(
    (row) => {
      const classRecord = relation(row, "classes");
      const subject = relation(row, "subjects");
      const submissions = asRows(row.submissions);
      const classId = stringValue(row.class_id);
      return {
        id: stringValue(row.id),
        title: stringValue(row.title, "Assignment"),
        classId,
        className: stringValue(classRecord?.name, "Class"),
        subjectId: stringValue(row.subject_id) || null,
        subjectName: stringValue(subject?.name) || null,
        status: stringValue(row.status, "draft"),
        dueAt: stringValue(row.due_at) || null,
        points: numberValue(row.points),
        submittedCount: submissions.length,
        gradedCount: submissions.filter(
          (submission) => submission.status === "graded",
        ).length,
        totalStudents: enrollmentsByClass.get(classId) ?? 0,
        attachments: asRows(row.attachments).map((attachment) => ({
          path: stringValue(attachment.path),
          name: stringValue(attachment.name, "Attachment"),
          size: numberValue(attachment.size),
          mimeType: stringValue(attachment.mimeType),
          signedUrl: attachmentUrlMap.get(stringValue(attachment.path)) ?? null,
        })),
      };
    },
  );
  const assignmentSubmissionRowsById = new Map(
    assignmentRowsRaw.map((row) => [
      stringValue(row.id),
      asRows(row.submissions),
    ]),
  );

  const attendanceHistory: TeacherAttendanceRow[] = attendanceRowsRaw.map(
    (row) => {
      const classRecord = relation(row, "classes");
      const profile = relation(row, "profiles");
      return {
        id: stringValue(row.id),
        classId: stringValue(row.class_id),
        className: stringValue(classRecord?.name, "Class"),
        studentName: stringValue(profile?.display_name, "Student"),
        studentUsername: stringValue(profile?.username) || null,
        status: stringValue(row.status, "present"),
        attendedOn: stringValue(row.attended_on),
        note: stringValue(row.note) || null,
      };
    },
  );

  const submissions: TeacherSubmissionRow[] = submissionsRaw.map(
    (row, index) => {
      const assignment = relation(row, "assignments");
      const profile = relation(row, "profiles");
      const filePath = stringValue(row.file_path) || null;
      return {
        id: stringValue(row.id),
        assignmentId:
          stringValue(row.assignment_id) || stringValue(assignment?.id),
        classId: stringValue(assignment?.class_id),
        studentId: stringValue(row.student_id),
        assignmentTitle: stringValue(assignment?.title, "Assignment"),
        studentName: stringValue(profile?.display_name, "Student"),
        status: stringValue(row.status, "submitted"),
        score: typeof row.score === "number" ? numberValue(row.score) : null,
        feedback: stringValue(row.feedback) || null,
        submittedAt: stringValue(row.submitted_at),
        gradedAt: stringValue(row.graded_at) || null,
        content: stringValue(row.content) || null,
        filePath,
        signedUrl: filePath ? (submissionSignedUrls[index] ?? null) : null,
        mimeType: stringValue(row.mime_type) || null,
        originalFilename:
          stringValue(row.original_filename) ||
          filePath?.split("/").pop() ||
          null,
      };
    },
  );

  const performance = students.map((student) => {
    const studentAttendance = attendanceRowsRaw.filter(
      (row) => stringValue(row.student_id) === student.id,
    );
    const presentCount = studentAttendance.filter(
      (row) => row.status === "present" || row.status === "late",
    ).length;
    const studentAssignments = assignmentRowsRaw.filter((assignment) =>
      student.classIds.includes(stringValue(assignment.class_id)),
    );
    const studentSubmissions = studentAssignments.flatMap((assignment) =>
      asRows(assignment.submissions).filter(
        (submission) => stringValue(submission.student_id) === student.id,
      ),
    );
    const gradedScores = studentSubmissions
      .map((submission) => numberValue(submission.score, NaN))
      .filter((score) => Number.isFinite(score));
    const averageScore = gradedScores.length
      ? Math.round(
          gradedScores.reduce((total, score) => total + score, 0) /
            gradedScores.length,
        )
      : 0;
    const lateCount = studentSubmissions.filter(
      (submission) => submission.status === "late",
    ).length;
    const missingCount = Math.max(
      0,
      studentAssignments.length - studentSubmissions.length,
    );
    const studentXpRows = xpRows.filter(
      (row) => stringValue(row.profile_id) === student.id,
    );
    const xp = studentXpRows.reduce(
      (total, row) => total + numberValue(row.xp),
      0,
    );
    const attendancePercent = percent(presentCount, studentAttendance.length);
    const submittedPercent = percent(
      studentSubmissions.length,
      studentAssignments.length,
    );
    const performanceScore = engagementHeavyPerformance({
      attendancePercent,
      submittedPercent,
      averageScore,
      xp,
      missingCount,
      lateCount,
      recentActivityCount: studentXpRows.length + studentSubmissions.length,
    });

    return {
      profileId: student.id,
      name: student.name,
      username: student.username,
      attendancePercent,
      submittedPercent,
      averageScore,
      xp,
      missingCount,
      lateCount,
      performanceScore,
      band: performanceBand(performanceScore),
    };
  });

  const missionSignalMap = new Map<string, TeacherMissionSignalRow>();
  const persistedMissionStatus = new Map<string, string>();
  function updateMissionSignal({
    profileId,
    classId,
    status,
    priority,
    title,
    missed,
  }: {
    profileId: string;
    classId: string | null;
    status: string;
    priority: string;
    title: string | null;
    missed?: boolean;
  }) {
    if (!profileId) return;

    const key = `${profileId}:${classId ?? "all"}`;
    const current =
      missionSignalMap.get(key) ??
      (prefixMissionSignal(
        profileId,
        classId,
      ) satisfies TeacherMissionSignalRow);

    if (status === "open") current.openCount += 1;
    if (status === "completed") current.completedCount += 1;
    if (status === "dismissed") current.dismissedCount += 1;
    if (priority === "urgent") current.urgentCount += 1;
    if (missed) current.missedCount += 1;
    if (!current.latestTitle && title) current.latestTitle = title;
    missionSignalMap.set(key, current);
  }

  function prefixMissionSignal(
    profileId: string,
    classId: string | null,
  ): TeacherMissionSignalRow {
    return {
      profileId,
      classId,
      openCount: 0,
      completedCount: 0,
      dismissedCount: 0,
      urgentCount: 0,
      missedCount: 0,
      latestTitle: null,
      lastActionAt: null,
      lastActionLabel: null,
      suggestedFollowUp: "No mission risk is visible yet.",
    };
  }

  for (const row of missionRowsRaw) {
    const profileId = stringValue(row.profile_id);
    const classId = stringValue(row.class_id) || null;
    if (!profileId) continue;
    const sourceKey = stringValue(row.source_key);
    if (sourceKey) {
      persistedMissionStatus.set(
        `${profileId}:${sourceKey}`,
        stringValue(row.status, "open"),
      );
    }

    updateMissionSignal({
      profileId,
      classId,
      status: stringValue(row.status, "open"),
      priority: stringValue(row.priority, "normal"),
      title: stringValue(row.title) || null,
      missed:
        stringValue(row.kind) === "missing_submission" ||
        stringValue(row.source_key).startsWith("assignment-missing:"),
    });
  }

  for (const row of missionEventRowsRaw) {
    const profileId = stringValue(row.profile_id);
    const classId = stringValue(row.class_id) || null;
    if (!profileId) continue;
    const key = `${profileId}:${classId ?? "all"}`;
    const current =
      missionSignalMap.get(key) ??
      (prefixMissionSignal(
        profileId,
        classId,
      ) satisfies TeacherMissionSignalRow);
    const createdAt = stringValue(row.created_at);
    if (
      createdAt &&
      (!current.lastActionAt ||
        new Date(createdAt).getTime() >
          new Date(current.lastActionAt).getTime())
    ) {
      current.lastActionAt = createdAt;
      current.lastActionLabel =
        stringValue(row.title) ||
        stringValue(row.event_type, "Mission activity").replace("_", " ");
    }
    missionSignalMap.set(key, current);
  }

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  for (const student of students) {
    const classAssignments = assignmentRows.filter(
      (assignment) =>
        assignment.status !== "draft" &&
        student.classIds.includes(assignment.classId),
    );

    for (const assignment of classAssignments) {
      const submitted = (
        assignmentSubmissionRowsById.get(assignment.id) ?? []
      ).some((submission) => stringValue(submission.student_id) === student.id);
      if (submitted || !assignment.dueAt) continue;

      const dueTime = new Date(assignment.dueAt).getTime();
      if (!Number.isFinite(dueTime)) continue;

      const isMissing = dueTime < now;
      const isUpcoming = dueTime >= now && dueTime <= now + sevenDays;
      if (!isMissing && !isUpcoming) continue;

      const sourceKey = isMissing
        ? `assignment-missing:${assignment.id}`
        : `assignment-due:${assignment.id}`;
      const persistedStatus = persistedMissionStatus.get(
        `${student.id}:${sourceKey}`,
      );
      if (persistedStatus) continue;

      updateMissionSignal({
        profileId: student.id,
        classId: assignment.classId,
        status: "open",
        priority: isMissing ? "urgent" : "high",
        missed: isMissing,
        title: isMissing
          ? `Missing: ${assignment.title}`
          : `Upcoming: ${assignment.title}`,
      });
    }
  }

  const missionSignals = Array.from(missionSignalMap.values()).map((signal) => {
    const performanceRow = performance.find(
      (row) => row.profileId === signal.profileId,
    );
    return {
      ...signal,
      suggestedFollowUp:
        signal.urgentCount > 0
          ? "Follow up on urgent mission blockers."
          : signal.missedCount > 0
            ? "Ask about missed work and agree on the next small step."
            : signal.openCount >= 3
              ? "Check why missions are staying open."
              : (performanceRow?.missingCount ?? 0) > 0
                ? "Ask about missing work before the next deadline."
                : signal.completedCount > 0
                  ? "Student is responding to missions."
                  : "No mission risk is visible yet.",
    };
  });

  const notes: Note[] = resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    subject: resource.subjectName ?? resource.className ?? "Resource",
    updatedAt: resource.createdAt,
    downloads: 0,
    type:
      resource.type === "video"
        ? "video"
        : resource.type === "pdf"
          ? "pdf"
          : "rich-note",
  }));

  const assignments: Assignment[] = assignmentRows.map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    className: assignment.className,
    subject: assignment.subjectName ?? "Subject",
    dueDate: assignment.dueAt ?? new Date().toISOString(),
    status:
      assignment.status === "closed"
        ? "graded"
        : assignment.gradedCount > 0 &&
            assignment.gradedCount === assignment.submittedCount
          ? "graded"
          : assignment.submittedCount > 0
            ? "submitted"
            : assignment.dueAt && new Date(assignment.dueAt) < new Date()
              ? "late"
              : "pending",
    points: assignment.points,
    submittedBy: assignment.submittedCount,
    totalStudents: assignment.totalStudents,
  }));

  const schedule: ScheduleItem[] = eventRowsRaw.slice(0, 8).map((row) => {
    const classRecord = relation(row, "classes");
    const kind = stringValue(row.kind, "event");
    return {
      time: timeLabel(stringValue(row.starts_at, new Date().toISOString())),
      title: stringValue(row.title, "Scheduled event"),
      meta: stringValue(classRecord?.name, "Teacher schedule"),
      kind:
        kind === "exam"
          ? "exam"
          : kind === "live"
            ? "live"
            : kind === "event"
              ? "event"
              : "study",
    };
  });

  const announcements: TeacherAnnouncementRow[] = announcementRowsRaw.map(
    (row) => {
      const classRecord = relation(row, "classes");
      return {
        id: stringValue(row.id),
        title: stringValue(row.title, "Announcement"),
        body: stringValue(row.body),
        classId: stringValue(row.class_id) || null,
        className: stringValue(classRecord?.name) || null,
        publishedAt: stringValue(row.published_at) || null,
      };
    },
  );

  const calendarEvents: TeacherCalendarEventRow[] = eventRowsRaw.map((row) => {
    const classRecord = relation(row, "classes");
    return {
      id: stringValue(row.id),
      title: stringValue(row.title, "Event"),
      kind: stringValue(row.kind, "event"),
      classId: stringValue(row.class_id) || null,
      className: stringValue(classRecord?.name) || null,
      startsAt: stringValue(row.starts_at),
      endsAt: stringValue(row.ends_at) || null,
    };
  });
  const availableStudentsById = new Map(
    availableStudents.map((student) => [student.id, student]),
  );
  const joinRequests: TeacherClassJoinRequestRow[] = joinRequestRowsRaw.map(
    (row) => {
      const studentId = stringValue(row.student_id);
      const student = availableStudentsById.get(studentId);
      return {
        id: stringValue(row.id),
        classId: stringValue(row.class_id),
        className:
          classById.get(stringValue(row.class_id))?.name ?? "Classroom",
        studentId,
        studentName: student?.name ?? "Student",
        studentUsername: student?.username ?? null,
        studentEmail: student?.email ?? null,
        status: stringValue(row.status, "pending"),
        requestedAt: stringValue(row.requested_at),
      };
    },
  );

  const messages: MessageThread[] = messageRowsRaw.slice(0, 8).map((row) => {
    const thread = relation(row, "message_threads");
    const sender = relation(row, "profiles");
    return {
      id: stringValue(row.id),
      name: stringValue(thread?.title, "Class thread"),
      role: stringValue(sender?.display_name, "Member"),
      preview: stringValue(row.body),
      unread: 0,
      time: timeLabel(stringValue(row.created_at, new Date().toISOString())),
    };
  });

  const attendanceByDate = new Map<
    string,
    { present: number; absent: number }
  >();
  for (const row of attendanceRowsRaw) {
    const label = dateLabel(
      stringValue(row.attended_on, new Date().toISOString()),
    );
    const current = attendanceByDate.get(label) ?? { present: 0, absent: 0 };
    if (row.status === "present" || row.status === "late") current.present += 1;
    if (row.status === "absent") current.absent += 1;
    attendanceByDate.set(label, current);
  }
  const attendanceChart = Array.from(attendanceByDate.entries()).map(
    ([label, value]) => ({ label, ...value }),
  );
  const engagementChart = attendanceChart.map((point) => ({
    label: point.label,
    engagement: percent(point.present, point.present + point.absent),
  }));
  const assignmentStatusChart = ["draft", "published", "closed"]
    .map((status) => ({
      name: status[0].toUpperCase() + status.slice(1),
      value: assignmentRows.filter((assignment) => assignment.status === status)
        .length,
    }))
    .filter((item) => item.value > 0);

  const activities: Activity[] = [
    ...announcements.slice(0, 4).map((announcement) => ({
      title: announcement.title,
      meta: announcement.className ?? "All classes",
      tone: "info" as const,
    })),
    ...calendarEvents.slice(0, 4).map((event) => ({
      title: event.title,
      meta: `${event.kind} - ${dateLabel(event.startsAt)}`,
      tone: event.kind === "exam" ? ("warning" as const) : ("primary" as const),
    })),
  ].slice(0, 8);

  const leaderboard: LeaderboardEntry[] = performance
    .slice()
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 8)
    .map((row, index) => ({
      rank: index + 1,
      name: row.username ? `@${row.username}` : row.name,
      points: row.xp,
      streak: Math.max(0, Math.round(row.attendancePercent / 10)),
      badge: row.band.replace("_", " "),
    }));

  const atRiskCount = performance.filter(
    (row) => row.band === "at_risk",
  ).length;
  const missingWorkCount = performance.reduce(
    (total, row) => total + row.missingCount,
    0,
  );
  const absentCount = attendanceRowsRaw.filter(
    (row) => row.status === "absent",
  ).length;
  const gradingBacklog = submissions.filter(
    (submission) => submission.status !== "graded",
  ).length;

  return {
    role: currentSession.role,
    connected: true,
    metrics: [
      {
        label: "Classes",
        value: `${classes.length}`,
        delta: "Teacher-owned",
        tone: "primary",
      },
      {
        label: "Students",
        value: `${students.length}`,
        delta: "Enrolled",
        tone: "success",
      },
      {
        label: "Grading",
        value: `${gradingBacklog}`,
        delta: "Open submissions",
        tone: "warning",
      },
      {
        label: "At risk",
        value: `${atRiskCount}`,
        delta: "Needs support",
        tone: "info",
      },
    ],
    classes,
    availableStudents,
    subjects,
    students,
    submissions,
    performance: performance.sort(
      (a, b) => a.performanceScore - b.performanceScore,
    ),
    missionSignals,
    resources,
    assignmentRows,
    attendanceHistory,
    announcements,
    calendarEvents,
    joinRequests,
    classTeachers,
    pendingTeacherInvites,
    profile: teacherProfileRecord
      ? {
          displayName: stringValue(teacherProfileRecord.display_name),
          email: stringValue(teacherProfileRecord.email) || null,
          username: stringValue(teacherProfileRecord.username) || null,
          bio: stringValue(teacherProfileRecord.bio) || null,
          tagline: stringValue(teacherSettings.tagline),
          officeHours: stringValue(teacherSettings.officeHours),
          gradingTargetHours: numberValue(
            teacherSettings.gradingTargetHours,
            48,
          ),
          aiAssistance:
            typeof teacherSettings.aiAssistance === "boolean"
              ? teacherSettings.aiAssistance
              : true,
        }
      : null,
    notes,
    assignments,
    schedule,
    messages,
    leaderboard,
    activities,
    riskSignals: [
      {
        label: "At-risk students",
        count: atRiskCount,
        severity: "high" as const,
      },
      {
        label: "Missing work",
        count: missingWorkCount,
        severity: "high" as const,
      },
      {
        label: "Absent records",
        count: absentCount,
        severity: "medium" as const,
      },
      {
        label: "Grading backlog",
        count: gradingBacklog,
        severity: "medium" as const,
      },
    ].filter((signal) => signal.count > 0),
    engagementChart,
    attendanceChart,
    assignmentStatusChart,
  };
}
