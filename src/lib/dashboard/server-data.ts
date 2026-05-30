import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { loadStudentTimetableSessions } from "@/lib/timetable/scheduler";
import type {
  Activity,
  Assignment,
  LeaderboardEntry,
  MessageThread,
  Metric,
  Note,
  ScheduleItem,
} from "@/lib/types";

type RiskSignal = {
  label: string;
  count: number;
  severity: "high" | "medium";
};

type DbRecord = Record<string, unknown>;

export type UpcomingTask = {
  id: string;
  title: string;
  kind: "assignment" | "event" | "exam" | "live";
  dueAt: string;
  className: string;
  status: string;
  href: string;
};

export type StudentClassRow = {
  id: string;
  name: string;
  description: string | null;
  bannerUrl: string | null;
  section: string | null;
  term: string | null;
  capacity: number | null;
  scheduleNote: string | null;
  teacherName: string | null;
  enrollmentStatus: "enrolled" | "pending" | "suggested" | "available";
  joinRequestId: string | null;
  suggestedReason: string | null;
  assignmentCount: number;
  resourceCount: number;
  announcementCount: number;
  classmates: Array<{
    id: string;
    name: string;
    username: string | null;
    email: string | null;
  }>;
  assignments: Assignment[];
  resources: Note[];
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    publishedAt: string | null;
  }>;
};

function asRows(value: unknown): DbRecord[] {
  return Array.isArray(value) ? (value as DbRecord[]) : [];
}

function relation(row: DbRecord, key: string) {
  const value = row[key];

  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

function recordValue(value: unknown): DbRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DbRecord)
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
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

function isMissingRelation(error: unknown, relationName: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(candidate.message?.includes(relationName))
  );
}

function streakFromActivity(rows: DbRecord[]) {
  const dates = new Set(
    rows
      .map((row) => stringValue(row.created_at))
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => date.toISOString().slice(0, 10)),
  );
  let cursor = new Date();
  let streak = 0;

  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  return streak;
}

function normalizedText(value: unknown) {
  return stringValue(value).trim().toLowerCase();
}

function suggestionForClass(classRecord: DbRecord, studentSettings: DbRecord) {
  const onboarding = recordValue(studentSettings.studentOnboarding);
  const academic = recordValue(onboarding.academic);
  const details = recordValue(onboarding.details);
  const department = normalizedText(academic.departmentName);
  const program = normalizedText(academic.program);
  const section = normalizedText(details.section);
  const classSection = normalizedText(classRecord.section);
  const haystack = [
    classRecord.name,
    classRecord.description,
    classRecord.grade_level,
    classRecord.batch,
    classRecord.term,
  ]
    .map(normalizedText)
    .filter(Boolean)
    .join(" ");

  if (section && classSection && section === classSection) {
    return `Matches section ${stringValue(classRecord.section)}`;
  }

  if (department && haystack.includes(department)) {
    return `Matches ${stringValue(academic.departmentName)}`;
  }

  if (program && haystack.includes(program)) {
    return `Matches ${stringValue(academic.program)}`;
  }

  return null;
}

export type DashboardData = {
  connected: boolean;
  metrics: Metric[];
  totalXp: number;
  currentStreak: number;
  engagementChart: Array<{ label: string; engagement: number }>;
  attendanceChart: Array<{ label: string; present: number; absent: number }>;
  assignmentStatusChart: Array<{ name: string; value: number }>;
  schedule: ScheduleItem[];
  assignments: Assignment[];
  upcomingTasks: UpcomingTask[];
  classes: StudentClassRow[];
  notes: Note[];
  leaderboard: LeaderboardEntry[];
  messages: MessageThread[];
  activities: Activity[];
  riskSignals: RiskSignal[];
};

const emptyMetrics: Metric[] = [
  {
    label: "Active records",
    value: "0",
    delta: "Add records",
    tone: "info",
  },
  { label: "Attendance", value: "0%", delta: "No data yet", tone: "warning" },
  { label: "Assignments", value: "0", delta: "No data yet", tone: "primary" },
  { label: "Engagement", value: "0%", delta: "No data yet", tone: "success" },
];

function emptyData(): DashboardData {
  return {
    connected: false,
    metrics: emptyMetrics,
    totalXp: 0,
    currentStreak: 0,
    engagementChart: [],
    attendanceChart: [],
    assignmentStatusChart: [],
    schedule: [],
    assignments: [],
    upcomingTasks: [],
    classes: [],
    notes: [],
    leaderboard: [],
    messages: [],
    activities: [],
    riskSignals: [],
  };
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

export async function getDashboardData(): Promise<DashboardData> {
  const session = await getCurrentAppSession();
  const supabase = getSupabaseServiceClient();

  if (!session || !supabase) return emptyData();

  const currentSession = session;
  const db = supabase;

  let profileResult = await db
    .from("profiles")
    .select("id,profile_settings")
    .eq("firebase_uid", currentSession.uid)
    .maybeSingle();

  if (
    profileResult.error &&
    isMissingColumn(profileResult.error, "profile_settings")
  ) {
    profileResult = await db
      .from("profiles")
      .select("id")
      .eq("firebase_uid", currentSession.uid)
      .maybeSingle();
  }

  const profile = (profileResult.data ?? null) as DbRecord | null;
  const profileId = stringValue(profile?.id);
  const profileSettings = recordValue(profile?.profile_settings);
  const isStudent = currentSession.role === "student";

  const initialEnrollmentResult =
    isStudent && profileId
      ? await db
          .from("enrollments")
          .select(
            "class_id,classes!enrollments_class_id_fkey(id,name,description,banner_url,section,teacher_id,profiles!classes_teacher_id_fkey(display_name))",
          )
          .eq("org_id", currentSession.orgId)
          .eq("student_id", profileId)
          .limit(1000)
      : { data: [], error: null };

  let enrollmentRows = !initialEnrollmentResult.error
    ? ((initialEnrollmentResult.data ?? []) as unknown as DbRecord[])
    : [];

  if (
    initialEnrollmentResult.error &&
    (isMissingColumn(initialEnrollmentResult.error, "description") ||
      isMissingColumn(initialEnrollmentResult.error, "banner_url"))
  ) {
    const fallbackEnrollmentResult =
      isStudent && profileId
        ? await db
            .from("enrollments")
            .select(
              "class_id,classes!enrollments_class_id_fkey(id,name,section,teacher_id,profiles!classes_teacher_id_fkey(display_name))",
            )
            .eq("org_id", currentSession.orgId)
            .eq("student_id", profileId)
            .limit(1000)
        : { data: [], error: null };

    if (!fallbackEnrollmentResult.error) {
      enrollmentRows = (fallbackEnrollmentResult.data ??
        []) as unknown as DbRecord[];
    }
  }

  const enrolledClassIds = enrollmentRows
    .map((row) => stringValue(row.class_id))
    .filter(Boolean);

  async function loadDiscoverableClasses(select: string, activeOnly = true) {
    const query = db
      .from("classes")
      .select(select)
      .eq("org_id", currentSession.orgId);

    if (activeOnly) query.is("archived_at", null);

    return await query.order("created_at", { ascending: false }).limit(1000);
  }

  let discoverableClassRows: DbRecord[] = [];
  if (isStudent && profileId) {
    let discoverableClassesResult = await loadDiscoverableClasses(
      "id,name,description,banner_url,section,grade_level,batch,term,capacity,schedule_note,teacher_id,profiles!classes_teacher_id_fkey(display_name)",
    );

    if (
      discoverableClassesResult.error &&
      (isMissingColumn(discoverableClassesResult.error, "description") ||
        isMissingColumn(discoverableClassesResult.error, "banner_url") ||
        isMissingColumn(discoverableClassesResult.error, "archived_at"))
    ) {
      discoverableClassesResult = await loadDiscoverableClasses(
        "id,name,section,teacher_id,profiles!classes_teacher_id_fkey(display_name)",
        false,
      );
    }

    if (!discoverableClassesResult.error) {
      discoverableClassRows = (discoverableClassesResult.data ??
        []) as unknown as DbRecord[];
    }
  }

  let joinRequestRows: DbRecord[] = [];
  if (isStudent && profileId) {
    const joinRequestsResult = await db
      .from("class_join_requests")
      .select("id,class_id,status")
      .eq("org_id", currentSession.orgId)
      .eq("student_id", profileId)
      .order("requested_at", { ascending: false })
      .limit(1000);

    if (!joinRequestsResult.error) {
      joinRequestRows = (joinRequestsResult.data ?? []) as DbRecord[];
    } else if (
      !isMissingRelation(joinRequestsResult.error, "class_join_requests")
    ) {
      joinRequestRows = [];
    }
  }

  let classmateRows: DbRecord[] = [];
  if (isStudent && enrolledClassIds.length > 0) {
    const classmatesResult = await db
      .from("enrollments")
      .select(
        "class_id,profiles!enrollments_student_id_fkey(id,display_name,username,email)",
      )
      .eq("org_id", currentSession.orgId)
      .in("class_id", enrolledClassIds)
      .limit(1000);

    if (!classmatesResult.error) {
      classmateRows = (classmatesResult.data ?? []) as unknown as DbRecord[];
    } else if (isMissingColumn(classmatesResult.error, "username")) {
      const fallbackClassmatesResult = await db
        .from("enrollments")
        .select(
          "class_id,profiles!enrollments_student_id_fkey(id,display_name,email)",
        )
        .eq("org_id", currentSession.orgId)
        .in("class_id", enrolledClassIds)
        .limit(1000);

      if (!fallbackClassmatesResult.error) {
        classmateRows = (fallbackClassmatesResult.data ??
          []) as unknown as DbRecord[];
      }
    }
  }

  async function loadAssignments(select: string) {
    if (isStudent && enrolledClassIds.length === 0) {
      return { data: [], error: null };
    }

    const query = db
      .from("assignments")
      .select(select)
      .eq("org_id", currentSession.orgId)
      .order("due_at", { ascending: true })
      .limit(1000);

    return isStudent
      ? await query.in("class_id", enrolledClassIds)
      : await query;
  }

  let assignmentsResult = await loadAssignments(
    "id,title,instructions,due_at,status,points,attachments,classes(id,name),subjects(name),submissions(status,score,submitted_at,file_path,content,feedback,student_id)",
  );

  if (
    assignmentsResult.error &&
    isMissingColumn(assignmentsResult.error, "attachments")
  ) {
    assignmentsResult = await loadAssignments(
      "id,title,instructions,due_at,status,points,classes(id,name),subjects(name),submissions(status,score,submitted_at,file_path,content,feedback,student_id)",
    );
  }

  const notificationsQuery = db
    .from("notifications")
    .select("title,body,kind,created_at")
    .eq("org_id", currentSession.orgId)
    .order("created_at", { ascending: false })
    .limit(8);

  const [
    resourcesResult,
    attendanceResult,
    eventsResult,
    messagesResult,
    gamificationResult,
    notificationsResult,
    membershipsResult,
    announcementsResult,
  ] = await Promise.all([
    db
      .from("resources")
      .select(
        "id,title,type,body,file_path,external_url,mime_type,original_filename,created_at,class_id,metadata,subjects(name),classes(name)",
      )
      .eq("org_id", currentSession.orgId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1000),
    db
      .from("attendance_records")
      .select(
        "status,attended_on,classes(name),profiles!attendance_records_student_id_fkey(display_name)",
      )
      .eq("org_id", currentSession.orgId)
      .order("attended_on", { ascending: false })
      .limit(200),
    db
      .from("calendar_events")
      .select("id,title,kind,starts_at,class_id,classes(name)")
      .eq("org_id", currentSession.orgId)
      .order("starts_at", { ascending: true })
      .limit(1000),
    db
      .from("messages")
      .select(
        "id,body,created_at,message_threads(title,kind),profiles(display_name)",
      )
      .eq("org_id", currentSession.orgId)
      .order("created_at", { ascending: false })
      .limit(8),
    db
      .from("gamification_events")
      .select("profile_id,xp,created_at,profiles(display_name)")
      .eq("org_id", currentSession.orgId)
      .limit(500),
    profileId
      ? notificationsQuery.eq("recipient_id", profileId)
      : notificationsQuery,
    db
      .from("memberships")
      .select("profile_id,status")
      .eq("org_id", currentSession.orgId)
      .eq("status", "active")
      .limit(1000),
    db
      .from("announcements")
      .select("id,title,body,published_at,class_id,classes(name)")
      .eq("org_id", currentSession.orgId)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (
    assignmentsResult.error ||
    resourcesResult.error ||
    attendanceResult.error ||
    eventsResult.error ||
    messagesResult.error ||
    gamificationResult.error ||
    notificationsResult.error ||
    membershipsResult.error ||
    announcementsResult.error
  ) {
    return emptyData();
  }

  const assignmentRows = (assignmentsResult.data ??
    []) as unknown as DbRecord[];
  const attendanceRows = (attendanceResult.data ?? []) as DbRecord[];
  const eventRows = (eventsResult.data ?? []) as DbRecord[];
  const resourceRows = (resourcesResult.data ?? []) as DbRecord[];
  const messageRows = (messagesResult.data ?? []) as DbRecord[];
  const gamificationRows = (gamificationResult.data ?? []) as DbRecord[];
  const notificationRows = (notificationsResult.data ?? []) as DbRecord[];
  const announcementRows = (announcementsResult.data ?? []) as DbRecord[];
  const attachmentUrlMap = new Map<string, string>();
  await Promise.all(
    assignmentRows.flatMap((row) =>
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
  const submissionUrlMap = new Map<string, string>();
  await Promise.all(
    assignmentRows.flatMap((row) =>
      asRows(row.submissions).map(async (submission) => {
        const path = stringValue(submission.file_path);
        if (!path) return;
        const { data } = await db.storage
          .from("submissions")
          .createSignedUrl(path, 60 * 10);
        if (data?.signedUrl) submissionUrlMap.set(path, data.signedUrl);
      }),
    ),
  );
  const resourceUrlMap = new Map<string, string>();
  await Promise.all(
    resourceRows.map(async (row) => {
      const path = stringValue(row.file_path);
      if (!path) return;
      const { data } = await db.storage
        .from("resources")
        .createSignedUrl(path, 60 * 10);
      if (data?.signedUrl) resourceUrlMap.set(path, data.signedUrl);
    }),
  );

  const timetableSessions =
    isStudent && profileId
      ? await loadStudentTimetableSessions({
          supabase: db,
          orgId: currentSession.orgId,
          profileId,
          days: 14,
        })
      : [];

  const submitted = assignmentRows.reduce((total, row) => {
    const submissions = asRows(row.submissions);
    return total + submissions.length;
  }, 0);
  const present = attendanceRows.filter(
    (row) => row.status === "present",
  ).length;
  const attendancePercent = percent(present, attendanceRows.length);
  const profileCount = new Set(
    ((membershipsResult.data ?? []) as DbRecord[])
      .map((row) => stringValue(row.profile_id))
      .filter(Boolean),
  ).size;
  const currentGamificationRows =
    isStudent && profileId
      ? gamificationRows.filter(
          (row) => stringValue(row.profile_id) === profileId,
        )
      : gamificationRows;
  const totalXp = currentGamificationRows.reduce(
    (total, row) => total + numberValue(row.xp),
    0,
  );
  const currentStreak = streakFromActivity(currentGamificationRows);

  const metrics: Metric[] = [
    {
      label: "Active records",
      value: `${profileCount}`,
      delta: "Active profiles",
      tone: "primary",
    },
    {
      label: "Attendance",
      value: `${attendancePercent}%`,
      delta: `${present}/${attendanceRows.length} present`,
      tone: "success",
    },
    {
      label: "Assignments",
      value: `${assignmentRows.length}`,
      delta: `${submitted} submissions`,
      tone: "info",
    },
    {
      label: "XP events",
      value: `${currentGamificationRows.length}`,
      delta: "Learning activity",
      tone: "warning",
    },
  ];

  const assignments: Assignment[] = assignmentRows.map((row) => {
    const submissions = asRows(row.submissions);
    const ownSubmissions =
      isStudent && profileId
        ? submissions.filter(
            (submission) => stringValue(submission.student_id) === profileId,
          )
        : submissions;
    const ownSubmission = ownSubmissions[0];
    const subject = relation(row, "subjects");
    const classRecord = relation(row, "classes");
    const dueDate = stringValue(row.due_at, new Date().toISOString());
    const hasOwnSubmission = Boolean(ownSubmission);
    const ownStatus = stringValue(ownSubmission?.status);
    const submissionFilePath = stringValue(ownSubmission?.file_path) || null;

    return {
      id: stringValue(row.id, crypto.randomUUID()),
      title: stringValue(row.title, "Untitled assignment"),
      classId: stringValue(classRecord?.id) || null,
      className: stringValue(classRecord?.name, "Class"),
      subject: stringValue(subject?.name, "Subject"),
      dueDate,
      status:
        ownStatus === "graded"
          ? "graded"
          : ownStatus === "late"
            ? "late"
            : hasOwnSubmission
              ? "submitted"
              : new Date(dueDate).getTime() < Date.now()
                ? "late"
                : "pending",
      points: numberValue(row.points),
      instructions: stringValue(row.instructions) || null,
      attachments: asRows(row.attachments).map((attachment) => ({
        path: stringValue(attachment.path),
        name: stringValue(attachment.name, "Attachment"),
        size: numberValue(attachment.size),
        mimeType: stringValue(attachment.mimeType),
        signedUrl: attachmentUrlMap.get(stringValue(attachment.path)) ?? null,
      })),
      submittedAt: stringValue(ownSubmission?.submitted_at) || null,
      feedback: stringValue(ownSubmission?.feedback) || null,
      submissionContent: stringValue(ownSubmission?.content) || null,
      submissionFilePath,
      submissionFileUrl: submissionFilePath
        ? (submissionUrlMap.get(submissionFilePath) ?? null)
        : null,
      submittedBy: isStudent ? (hasOwnSubmission ? 1 : 0) : submissions.length,
      totalStudents: isStudent ? 1 : Math.max(profileCount, submissions.length),
      grade:
        typeof ownSubmission?.score === "number"
          ? `${ownSubmission.score}%`
          : undefined,
    };
  });

  const visibleResourceRows = isStudent
    ? resourceRows.filter((row) => {
        const classId = stringValue(row.class_id);
        if (classId) return enrolledClassIds.includes(classId);

        const metadata = recordValue(row.metadata);
        const ownerProfileId = stringValue(
          metadata.owner_profile_id ?? metadata.ownerProfileId,
        );

        return !ownerProfileId || ownerProfileId === profileId;
      })
    : resourceRows;
  const visibleAnnouncementRows = isStudent
    ? announcementRows.filter((row) => {
        const classId = stringValue(row.class_id);
        return !classId || enrolledClassIds.includes(classId);
      })
    : announcementRows;
  const visibleEventRows = isStudent
    ? eventRows.filter((row) => {
        const classId = stringValue(row.class_id);
        return !classId || enrolledClassIds.includes(classId);
      })
    : eventRows;

  function resourceToNote(row: DbRecord): Note {
    const subject = relation(row, "subjects");
    const classRecord = relation(row, "classes");
    const metadata = recordValue(row.metadata);
    const ownerProfileId =
      stringValue(metadata.owner_profile_id ?? metadata.ownerProfileId) || null;
    const visibility = stringValue(metadata.visibility);

    return {
      id: stringValue(row.id, crypto.randomUUID()),
      title: stringValue(row.title, "Untitled resource"),
      subject: stringValue(subject?.name, "Resource"),
      classId: stringValue(row.class_id) || null,
      className: stringValue(classRecord?.name) || null,
      updatedAt: stringValue(row.created_at, new Date().toISOString()),
      downloads: 0,
      body: stringValue(row.body) || null,
      externalUrl: stringValue(row.external_url) || null,
      fileUrl: resourceUrlMap.get(stringValue(row.file_path)) ?? null,
      filePath: stringValue(row.file_path) || null,
      mimeType: stringValue(row.mime_type) || null,
      originalFilename: stringValue(row.original_filename) || null,
      ownerProfileId,
      ownedByStudent: Boolean(profileId && ownerProfileId === profileId),
      visibility:
        visibility === "class" || visibility === "organization"
          ? visibility
          : "private",
      type:
        row.type === "video"
          ? "video"
          : row.type === "pdf"
            ? "pdf"
            : "rich-note",
    };
  }

  const notes: Note[] = visibleResourceRows.map(resourceToNote);

  const classRecordsById = new Map<string, DbRecord>();
  for (const row of enrollmentRows) {
    const classRecord = relation(row, "classes");
    const classId = stringValue(classRecord?.id) || stringValue(row.class_id);
    if (classId && classRecord) classRecordsById.set(classId, classRecord);
  }
  for (const row of discoverableClassRows) {
    const classId = stringValue(row.id);
    if (classId) classRecordsById.set(classId, row);
  }

  const joinRequestsByClass = new Map(
    joinRequestRows
      .map((row) => [stringValue(row.class_id), row] as const)
      .filter(([classId]) => Boolean(classId)),
  );

  const classes: StudentClassRow[] = Array.from(classRecordsById.entries())
    .map(([classId, classRecord]) => {
      if (!classId) return null;

      const isEnrolled = enrolledClassIds.includes(classId);
      const requestRow = joinRequestsByClass.get(classId);
      const requestStatus = stringValue(requestRow?.status);
      const suggestedReason = isEnrolled
        ? null
        : suggestionForClass(classRecord, profileSettings);
      const enrollmentStatus: StudentClassRow["enrollmentStatus"] = isEnrolled
        ? "enrolled"
        : requestStatus === "pending"
          ? "pending"
          : suggestedReason
            ? "suggested"
            : "available";

      const teacher = relation(classRecord, "profiles");
      const classResources = isEnrolled
        ? visibleResourceRows.filter(
            (resource) => stringValue(resource.class_id) === classId,
          )
        : [];
      const classAnnouncements = isEnrolled
        ? visibleAnnouncementRows.filter(
            (announcement) => stringValue(announcement.class_id) === classId,
          )
        : [];
      const classAssignments = isEnrolled
        ? assignments.filter((assignment) => assignment.classId === classId)
        : [];
      const classmates = isEnrolled
        ? classmateRows
            .filter((classmate) => stringValue(classmate.class_id) === classId)
            .map((classmate) => {
              const person = relation(classmate, "profiles");
              return {
                id: stringValue(person?.id),
                name: stringValue(person?.display_name, "Student"),
                username: stringValue(person?.username) || null,
                email: stringValue(person?.email) || null,
              };
            })
            .filter((classmate) => Boolean(classmate.id))
        : [];

      return {
        id: classId,
        name: stringValue(classRecord?.name, "Class"),
        description: stringValue(classRecord?.description) || null,
        bannerUrl: stringValue(classRecord?.banner_url) || null,
        section: stringValue(classRecord?.section) || null,
        term: stringValue(classRecord?.term) || null,
        capacity:
          typeof classRecord?.capacity === "number"
            ? numberValue(classRecord.capacity)
            : null,
        scheduleNote: stringValue(classRecord?.schedule_note) || null,
        teacherName: stringValue(teacher?.display_name) || null,
        enrollmentStatus,
        joinRequestId: stringValue(requestRow?.id) || null,
        suggestedReason,
        assignmentCount: classAssignments.length,
        resourceCount: classResources.length,
        announcementCount: classAnnouncements.length,
        classmates,
        assignments: classAssignments,
        resources: classResources.map(resourceToNote),
        announcements: classAnnouncements.map((announcement) => ({
          id: stringValue(announcement.id, crypto.randomUUID()),
          title: stringValue(announcement.title, "Announcement"),
          body: stringValue(announcement.body),
          publishedAt: stringValue(announcement.published_at) || null,
        })),
      } satisfies StudentClassRow;
    })
    .filter((classRecord): classRecord is StudentClassRow =>
      Boolean(classRecord),
    )
    .sort((a, b) => {
      const order = { enrolled: 0, pending: 1, suggested: 2, available: 3 };
      return order[a.enrollmentStatus] - order[b.enrollmentStatus];
    });

  const eventSchedule: ScheduleItem[] = visibleEventRows.map((row) => {
    const date = new Date(stringValue(row.starts_at, new Date().toISOString()));
    const classRecord = relation(row, "classes");
    const kind: ScheduleItem["kind"] =
      row.kind === "exam"
        ? "exam"
        : row.kind === "live"
          ? "live"
          : row.kind === "event"
            ? "event"
            : "study";

    return {
      time: date.toLocaleTimeString("en", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      title: stringValue(row.title, "Scheduled event"),
      meta: stringValue(classRecord?.name, "Personal schedule"),
      kind,
    };
  });

  const schedule: ScheduleItem[] = [
    ...timetableSessions.slice(0, 8).map((session) => ({
      time: new Date(session.startsAt).toLocaleTimeString("en", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      title: session.subjectName,
      meta: [session.className, session.venue, session.teacherName]
        .filter(Boolean)
        .join(" - "),
      kind: "live" as const,
    })),
    ...eventSchedule,
  ];

  const now = Date.now();
  const upcomingTasks: UpcomingTask[] = [
    ...assignments
      .filter(
        (assignment) =>
          assignment.status === "pending" || assignment.status === "late",
      )
      .map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        kind: "assignment" as const,
        dueAt: assignment.dueDate,
        className: assignment.className,
        status: assignment.status,
        href: `/student/assignments/${assignment.id}`,
      })),
    ...visibleEventRows
      .map((row) => {
        const classRecord = relation(row, "classes");
        const kind = stringValue(row.kind, "event");
        return {
          id: stringValue(row.id, crypto.randomUUID()),
          title: stringValue(row.title, "Scheduled event"),
          kind:
            kind === "exam"
              ? ("exam" as const)
              : kind === "live"
                ? ("live" as const)
                : ("event" as const),
          dueAt: stringValue(row.starts_at, new Date().toISOString()),
          className: stringValue(classRecord?.name, "Schedule"),
          status: kind,
          href: "/student/calendar",
        };
      })
      .filter((task) => new Date(task.dueAt).getTime() >= now),
    ...timetableSessions.map((session) => ({
      id: session.id,
      title: session.subjectName,
      kind: "live" as const,
      dueAt: session.startsAt,
      className: [session.className, session.venue].filter(Boolean).join(" - "),
      status: "scheduled",
      href: session.actionUrl,
    })),
  ]
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 1000);

  const messages: MessageThread[] = messageRows.map((row) => {
    const thread = relation(row, "message_threads");
    const sender = relation(row, "profiles");

    return {
      id: stringValue(row.id, crypto.randomUUID()),
      name: stringValue(thread?.title, "Message"),
      role: stringValue(sender?.display_name, "Member"),
      preview: stringValue(row.body, ""),
      unread: 0,
      time: new Date(
        stringValue(row.created_at, new Date().toISOString()),
      ).toLocaleTimeString("en", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });

  const xpByName = new Map<string, { points: number; count: number }>();
  for (const row of gamificationRows) {
    const profile = relation(row, "profiles");
    const name = stringValue(profile?.display_name, "Learner");
    const current = xpByName.get(name) ?? { points: 0, count: 0 };
    xpByName.set(name, {
      points: current.points + numberValue(row.xp),
      count: current.count + 1,
    });
  }

  const leaderboard: LeaderboardEntry[] = Array.from(xpByName.entries())
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 8)
    .map(([name, value], index) => ({
      rank: index + 1,
      name,
      points: value.points,
      streak: value.count,
      badge: value.points > 500 ? "Momentum Leader" : "Active Learner",
    }));

  const activities: Activity[] = notificationRows.map((row) => ({
    title: stringValue(row.title, "Notification"),
    meta: stringValue(row.body, ""),
    tone:
      row.kind === "achievement"
        ? "success"
        : row.kind === "warning"
          ? "warning"
          : "info",
  }));

  const riskSignals: RiskSignal[] = [
    {
      label: "Absent records",
      count: attendanceRows.filter((row) => row.status === "absent").length,
      severity: "high",
    },
    {
      label: "Assignments with no submissions",
      count: assignmentRows.filter(
        (row) =>
          !Array.isArray(row.submissions) || row.submissions.length === 0,
      ).length,
      severity: "medium",
    },
  ];

  const attendanceByDate = new Map<
    string,
    { present: number; absent: number }
  >();
  for (const row of attendanceRows) {
    const label = new Date(
      stringValue(row.attended_on, new Date().toISOString()),
    ).toLocaleDateString("en", { month: "short", day: "numeric" });
    const current = attendanceByDate.get(label) ?? { present: 0, absent: 0 };
    if (row.status === "present") current.present += 1;
    if (row.status === "absent") current.absent += 1;
    attendanceByDate.set(label, current);
  }

  const attendanceChart = Array.from(attendanceByDate.entries()).map(
    ([label, value]) => ({
      label,
      ...value,
    }),
  );
  const assignmentStatusChart = ["pending", "submitted", "graded", "late"]
    .map((status) => ({
      name: status[0].toUpperCase() + status.slice(1),
      value: assignments.filter((assignment) => assignment.status === status)
        .length,
    }))
    .filter((item) => item.value > 0);
  const engagementChart = attendanceChart.map((point) => ({
    label: point.label,
    engagement: percent(point.present, point.present + point.absent),
  }));

  return {
    connected: true,
    metrics,
    totalXp,
    currentStreak,
    engagementChart,
    attendanceChart,
    assignmentStatusChart,
    schedule,
    assignments,
    upcomingTasks,
    classes,
    notes,
    leaderboard,
    messages,
    activities,
    riskSignals,
  };
}
