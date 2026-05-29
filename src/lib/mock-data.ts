import {
  CalendarDays,
  CalendarClock,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileText,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Medal,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UsersRound,
  UserPlus,
} from "lucide-react";
import type {
  Activity,
  AnalyticsPoint,
  Assignment,
  LeaderboardEntry,
  Metric,
  MessageThread,
  NavItem,
  Note,
  Role,
  ScheduleItem,
} from "@/lib/types";

export const demoOrg = {
  id: "org-lumina-academy",
  name: "EduPulse Academy Network",
  term: "Spring Term 2026",
};

export const demoUsers = {
  student: {
    uid: "demo-student",
    email: "student@edupulse.demo",
    displayName: "Ayla Rahman",
    role: "student" as Role,
  },
  teacher: {
    uid: "demo-teacher",
    email: "teacher@edupulse.demo",
    displayName: "Mikael Chen",
    role: "teacher" as Role,
  },
  admin: {
    uid: "demo-admin",
    email: "admin@edupulse.demo",
    displayName: "Sara Malik",
    role: "admin" as Role,
  },
  super_admin: {
    uid: "demo-super-admin",
    email: "superadmin@edupulse.demo",
    displayName: "Platform Owner",
    role: "super_admin" as Role,
  },
};

export const roleNav: Record<Role, NavItem[]> = {
  student: [
    { title: "Dashboard", href: "/student", icon: LayoutDashboard },
    {
      title: "Analytics",
      href: "/student/analytics",
      icon: ChartNoAxesCombined,
    },
    { title: "Missions", href: "/student/missions", icon: Sparkles },
    { title: "Classes", href: "/student/classes", icon: GraduationCap },
    { title: "Upcoming", href: "/student/upcoming", icon: CalendarClock },
    {
      title: "Assignments",
      href: "/student/assignments",
      icon: ClipboardCheck,
    },
    { title: "Notes", href: "/student/notes", icon: FileText },
    { title: "Leaderboard", href: "/student/leaderboard", icon: Medal },
    { title: "Calendar", href: "/student/calendar", icon: CalendarDays },
    { title: "Messages", href: "/student/messages", icon: MessageSquareText },
    { title: "Settings", href: "/student/settings", icon: Settings },
  ],
  teacher: [
    { title: "Dashboard", href: "/teacher", icon: LayoutDashboard },
    { title: "Classes", href: "/teacher/classes", icon: GraduationCap },
    { title: "Requests", href: "/teacher/requests", icon: UserPlus },
    {
      title: "Assignments",
      href: "/teacher/assignments",
      icon: ClipboardCheck,
    },
    {
      title: "Analytics",
      href: "/teacher/analytics",
      icon: ChartNoAxesCombined,
    },
    { title: "Uploads", href: "/teacher/uploads", icon: UploadCloud },
    { title: "Messages", href: "/teacher/messages", icon: MessageSquareText },
    { title: "Settings", href: "/teacher/settings", icon: Settings },
  ],
  admin: [
    { title: "Dashboard", href: "/admin", icon: Gauge },
    { title: "Users", href: "/admin/users", icon: UsersRound },
    { title: "ID Maker", href: "/admin/id-maker", icon: UserPlus },
    { title: "Invites", href: "/admin/invites", icon: UserPlus },
    { title: "Contact", href: "/admin/contact", icon: MessageSquareText },
    { title: "Reports", href: "/admin/reports", icon: FileText },
    { title: "Analytics", href: "/admin/analytics", icon: ChartNoAxesCombined },
    { title: "Moderation", href: "/admin/moderation", icon: ShieldCheck },
    { title: "Security", href: "/admin/security", icon: ShieldCheck },
    { title: "Settings", href: "/admin/settings", icon: Settings },
  ],
  super_admin: [
    { title: "Dashboard", href: "/admin", icon: Gauge },
    { title: "Organizations", href: "/admin/users", icon: GraduationCap },
    { title: "ID Maker", href: "/admin/id-maker", icon: UserPlus },
    { title: "Contact", href: "/admin/contact", icon: MessageSquareText },
    { title: "Reports", href: "/admin/reports", icon: FileText },
    { title: "Settings", href: "/admin/settings", icon: Settings },
  ],
};

export const publicNav = [
  { title: "Features", href: "/features" },
  { title: "About", href: "/about" },
  { title: "Support", href: "/contact" },
];

export const platformMetrics: Metric[] = [
  {
    label: "Active learners",
    value: "18,420",
    delta: "+14.2%",
    tone: "primary",
  },
  { label: "Attendance rate", value: "91%", delta: "+4.8%", tone: "success" },
  {
    label: "Assignment completion",
    value: "86%",
    delta: "+7.1%",
    tone: "info",
  },
  { label: "At-risk alerts", value: "142", delta: "-9.3%", tone: "warning" },
];

export const studentMetrics: Metric[] = [
  { label: "XP this week", value: "1,840", delta: "+320", tone: "primary" },
  { label: "Attendance", value: "94%", delta: "+3%", tone: "success" },
  { label: "Pending tasks", value: "4", delta: "2 due soon", tone: "warning" },
  { label: "Level", value: "12", delta: "680 XP to 13", tone: "info" },
];

export const teacherMetrics: Metric[] = [
  { label: "Classes today", value: "6", delta: "2 live", tone: "primary" },
  { label: "Submissions", value: "184", delta: "+37 today", tone: "success" },
  { label: "Needs grading", value: "28", delta: "11 urgent", tone: "warning" },
  { label: "Engagement", value: "88%", delta: "+6%", tone: "info" },
];

export const schedule: ScheduleItem[] = [
  {
    time: "08:30",
    title: "Physics: Momentum Lab",
    meta: "Grade 10-A • Room 204",
    kind: "live",
  },
  {
    time: "10:00",
    title: "Mathematics Challenge",
    meta: "Online • 45 min",
    kind: "exam",
  },
  {
    time: "12:20",
    title: "English literature circle",
    meta: "Discussion thread",
    kind: "study",
  },
  {
    time: "15:00",
    title: "Career mentor session",
    meta: "Auditorium",
    kind: "event",
  },
];

export const assignments: Assignment[] = [
  {
    id: "asg-1",
    title: "Vector Forces Simulation",
    className: "Grade 10-A",
    subject: "Physics",
    dueDate: "2026-05-20",
    status: "pending",
    points: 120,
    submittedBy: 21,
    totalStudents: 32,
  },
  {
    id: "asg-2",
    title: "Algebra Mastery Set",
    className: "Batch Alpha",
    subject: "Mathematics",
    dueDate: "2026-05-21",
    status: "submitted",
    points: 80,
    submittedBy: 28,
    totalStudents: 32,
  },
  {
    id: "asg-3",
    title: "Argument Essay Draft",
    className: "Grade 10-A",
    subject: "English",
    dueDate: "2026-05-17",
    status: "graded",
    points: 100,
    grade: "A-",
    submittedBy: 31,
    totalStudents: 32,
  },
  {
    id: "asg-4",
    title: "Organic Chemistry Notes",
    className: "Coaching Weekend",
    subject: "Chemistry",
    dueDate: "2026-05-23",
    status: "pending",
    points: 70,
    submittedBy: 19,
    totalStudents: 26,
  },
];

export const notes: Note[] = [
  {
    id: "note-1",
    title: "Momentum and impulse visual guide",
    subject: "Physics",
    updatedAt: "2026-05-18",
    downloads: 482,
    type: "pdf",
  },
  {
    id: "note-2",
    title: "Quadratic patterns interactive worksheet",
    subject: "Mathematics",
    updatedAt: "2026-05-16",
    downloads: 391,
    type: "rich-note",
  },
  {
    id: "note-3",
    title: "Essay structure mini lesson",
    subject: "English",
    updatedAt: "2026-05-14",
    downloads: 266,
    type: "video",
  },
];

export const leaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    name: "Ayla Rahman",
    points: 18420,
    streak: 24,
    badge: "Focus Architect",
  },
  {
    rank: 2,
    name: "Noah Iqbal",
    points: 17990,
    streak: 18,
    badge: "Problem Solver",
  },
  {
    rank: 3,
    name: "Zara Khan",
    points: 17440,
    streak: 21,
    badge: "Lab Leader",
  },
  {
    rank: 4,
    name: "Leo Santos",
    points: 16820,
    streak: 15,
    badge: "Quiz Master",
  },
];

export const messages: MessageThread[] = [
  {
    id: "msg-1",
    name: "Physics 10-A",
    role: "Class channel",
    preview: "New lab rubric has been attached.",
    unread: 3,
    time: "5m",
  },
  {
    id: "msg-2",
    name: "Ms. Noor",
    role: "Teacher",
    preview: "Your essay outline is much stronger now.",
    unread: 1,
    time: "18m",
  },
  {
    id: "msg-3",
    name: "Study Squad",
    role: "Group thread",
    preview: "Let us review algebra at 7 PM.",
    unread: 0,
    time: "1h",
  },
];

export const activities: Activity[] = [
  {
    title: "Achievement unlocked",
    meta: "24-day study streak",
    tone: "success",
  },
  {
    title: "Assignment reminder",
    meta: "Vector simulation due in 2 days",
    tone: "warning",
  },
  {
    title: "Teacher feedback",
    meta: "Essay draft received new comments",
    tone: "info",
  },
  {
    title: "Class announcement",
    meta: "Chemistry lab moved online",
    tone: "primary",
  },
];

export const analytics: AnalyticsPoint[] = [
  { label: "Mon", engagement: 78, attendance: 92, completion: 70 },
  { label: "Tue", engagement: 84, attendance: 94, completion: 76 },
  { label: "Wed", engagement: 89, attendance: 91, completion: 82 },
  { label: "Thu", engagement: 91, attendance: 96, completion: 86 },
  { label: "Fri", engagement: 87, attendance: 93, completion: 88 },
  { label: "Sat", engagement: 76, attendance: 84, completion: 81 },
];

export const attendanceMonths = [
  { label: "Jan", present: 93, absent: 7 },
  { label: "Feb", present: 90, absent: 10 },
  { label: "Mar", present: 96, absent: 4 },
  { label: "Apr", present: 91, absent: 9 },
  { label: "May", present: 94, absent: 6 },
];

export const reports = [
  "Cross-campus attendance summary",
  "Teacher activity and grading speed",
  "Class engagement heatmap",
  "Assignment completion export",
  "At-risk student intervention log",
];

export const moderationQueue = [
  "Discussion thread flagged for review",
  "Resource upload awaiting approval",
  "Profile image safety check",
  "Announcement draft pending publish",
];

export const quickActions = {
  student: [
    "Resume Physics practice",
    "Submit pending assignment",
    "Ask AI for revision plan",
    "Join next live class",
  ],
  teacher: [
    "Create a class",
    "Open assignments",
    "Upload lesson resource",
    "Message students",
  ],
  admin: [
    "Invite staff members",
    "Review moderation queue",
    "Export weekly report",
    "Audit role permissions",
  ],
};

export const riskSignals = [
  { label: "Missed two assignments", count: 17, severity: "high" },
  { label: "Attendance below 80%", count: 23, severity: "high" },
  { label: "Low discussion activity", count: 48, severity: "medium" },
  { label: "No login in 5 days", count: 31, severity: "medium" },
];

export const onboardingSteps = [
  { title: "Create organization", done: true },
  { title: "Invite teachers", done: true },
  { title: "Import students", done: true },
  { title: "Publish first class", done: true },
  { title: "Enable AI guardrails", done: false },
];

export const securityControls = [
  { title: "Server route gates", status: "Enabled", tone: "success" },
  { title: "Tenant data isolation", status: "Required", tone: "success" },
  { title: "Storage tenant paths", status: "Guarded", tone: "info" },
  { title: "Verified role access", status: "Required", tone: "warning" },
  { title: "AI audit logs", status: "Enabled", tone: "success" },
];

export const bestNextFeatures = [
  "Parent portal with progress digests and fee-free communication",
  "Adaptive practice engine based on weak-topic detection",
  "Exam builder with question banks and proctoring hooks",
  "Offline-first mobile app for low-connectivity classrooms",
  "Automated intervention workflows for at-risk students",
  "Institute marketplace for reusable premium lesson packs",
];
