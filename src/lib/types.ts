import type { LucideIcon } from "lucide-react";

export type Role = "student" | "teacher" | "admin" | "super_admin";

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL?: string | null;
  emailVerified: boolean;
  role: Role;
  orgId: string;
  orgName: string;
  deviceSessionId: string;
  onboardingCompleted: boolean;
};

export type AuthSessionResult = {
  role: Role;
  orgId: string;
  orgName: string;
  onboardingCompleted: boolean;
};

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type Metric = {
  label: string;
  value: string;
  delta: string;
  tone: "primary" | "success" | "warning" | "info";
};

export type AssignmentStatus = "submitted" | "pending" | "graded" | "late";

export type Assignment = {
  id: string;
  title: string;
  className: string;
  subject: string;
  dueDate: string;
  status: AssignmentStatus;
  points: number;
  submittedBy?: number;
  totalStudents?: number;
  grade?: string;
};

export type ScheduleItem = {
  time: string;
  title: string;
  meta: string;
  kind: "live" | "exam" | "study" | "event";
};

export type Note = {
  id: string;
  title: string;
  subject: string;
  updatedAt: string;
  downloads: number;
  type: "pdf" | "video" | "rich-note";
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  points: number;
  streak: number;
  badge: string;
};

export type MessageThread = {
  id: string;
  name: string;
  role: string;
  preview: string;
  unread: number;
  time: string;
};

export type Activity = {
  title: string;
  meta: string;
  tone: "primary" | "success" | "warning" | "info";
};

export type AnalyticsPoint = {
  label: string;
  engagement: number;
  attendance: number;
  completion: number;
};
