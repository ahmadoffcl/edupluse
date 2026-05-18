import "server-only";
import { getCurrentAppSession } from "@/lib/auth/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
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

function asRows(value: unknown): DbRecord[] {
  return Array.isArray(value) ? (value as DbRecord[]) : [];
}

function relation(row: DbRecord, key: string) {
  const value = row[key];

  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

export type DashboardData = {
  connected: boolean;
  metrics: Metric[];
  totalXp: number;
  engagementChart: Array<{ label: string; engagement: number }>;
  attendanceChart: Array<{ label: string; present: number; absent: number }>;
  assignmentStatusChart: Array<{ name: string; value: number }>;
  schedule: ScheduleItem[];
  assignments: Assignment[];
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
    engagementChart: [],
    attendanceChart: [],
    assignmentStatusChart: [],
    schedule: [],
    assignments: [],
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

  const [
    assignmentsResult,
    resourcesResult,
    attendanceResult,
    eventsResult,
    messagesResult,
    gamificationResult,
    notificationsResult,
    membershipsResult,
  ] = await Promise.all([
    supabase
      .from("assignments")
      .select(
        "id,title,due_at,status,points,classes(name),subjects(name),submissions(status,score)",
      )
      .eq("org_id", session.orgId)
      .order("due_at", { ascending: true })
      .limit(12),
    supabase
      .from("resources")
      .select("id,title,type,created_at,subjects(name)")
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("attendance_records")
      .select("status,attended_on,classes(name),profiles(display_name)")
      .eq("org_id", session.orgId)
      .order("attended_on", { ascending: false })
      .limit(200),
    supabase
      .from("calendar_events")
      .select("id,title,kind,starts_at,classes(name)")
      .eq("org_id", session.orgId)
      .order("starts_at", { ascending: true })
      .limit(8),
    supabase
      .from("messages")
      .select(
        "id,body,created_at,message_threads(title,kind),profiles(display_name)",
      )
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("gamification_events")
      .select("xp,created_at,profiles(display_name)")
      .eq("org_id", session.orgId)
      .limit(500),
    supabase
      .from("notifications")
      .select("title,body,kind,created_at")
      .eq("org_id", session.orgId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("memberships")
      .select("profile_id,status")
      .eq("org_id", session.orgId)
      .eq("status", "active")
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
    membershipsResult.error
  ) {
    return emptyData();
  }

  const assignmentRows = (assignmentsResult.data ?? []) as DbRecord[];
  const attendanceRows = (attendanceResult.data ?? []) as DbRecord[];
  const eventRows = (eventsResult.data ?? []) as DbRecord[];
  const resourceRows = (resourcesResult.data ?? []) as DbRecord[];
  const messageRows = (messagesResult.data ?? []) as DbRecord[];
  const gamificationRows = (gamificationResult.data ?? []) as DbRecord[];
  const notificationRows = (notificationsResult.data ?? []) as DbRecord[];

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
      value: `${gamificationRows.length}`,
      delta: "Learning activity",
      tone: "warning",
    },
  ];
  const totalXp = gamificationRows.reduce(
    (total, row) => total + numberValue(row.xp),
    0,
  );

  const assignments: Assignment[] = assignmentRows.map((row) => {
    const submissions = asRows(row.submissions);
    const subject = relation(row, "subjects");
    const classRecord = relation(row, "classes");

    return {
      id: stringValue(row.id, crypto.randomUUID()),
      title: stringValue(row.title, "Untitled assignment"),
      className: stringValue(classRecord?.name, "Class"),
      subject: stringValue(subject?.name, "Subject"),
      dueDate: stringValue(row.due_at, new Date().toISOString()),
      status: submissions.some((submission) => submission.status === "graded")
        ? "graded"
        : submissions.length
          ? "submitted"
          : "pending",
      points: numberValue(row.points),
      submittedBy: submissions.length,
      totalStudents: Math.max(profileCount, submissions.length),
      grade:
        typeof submissions[0]?.score === "number"
          ? `${submissions[0].score}%`
          : undefined,
    };
  });

  const notes: Note[] = resourceRows.map((row) => {
    const subject = relation(row, "subjects");
    return {
      id: stringValue(row.id, crypto.randomUUID()),
      title: stringValue(row.title, "Untitled resource"),
      subject: stringValue(subject?.name, "Resource"),
      updatedAt: stringValue(row.created_at, new Date().toISOString()),
      downloads: 0,
      type:
        row.type === "video"
          ? "video"
          : row.type === "pdf"
            ? "pdf"
            : "rich-note",
    };
  });

  const schedule: ScheduleItem[] = eventRows.map((row) => {
    const date = new Date(stringValue(row.starts_at, new Date().toISOString()));
    const classRecord = relation(row, "classes");

    return {
      time: date.toLocaleTimeString("en", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      title: stringValue(row.title, "Scheduled event"),
      meta: stringValue(classRecord?.name, "Personal schedule"),
      kind:
        row.kind === "exam"
          ? "exam"
          : row.kind === "live"
            ? "live"
            : row.kind === "event"
              ? "event"
              : "study",
    };
  });

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
    engagementChart,
    attendanceChart,
    assignmentStatusChart,
    schedule,
    assignments,
    notes,
    leaderboard,
    messages,
    activities,
    riskSignals,
  };
}
