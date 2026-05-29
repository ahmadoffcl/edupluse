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
  uid?: string;
  email?: string | null;
  role: Role;
  orgId: string;
  orgName: string;
  photoURL?: string | null;
  onboardingCompleted: boolean;
  setupPending?: boolean;
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
  classId?: string | null;
  className: string;
  subject: string;
  dueDate: string;
  status: AssignmentStatus;
  points: number;
  instructions?: string | null;
  submittedAt?: string | null;
  feedback?: string | null;
  submissionContent?: string | null;
  submissionFilePath?: string | null;
  submissionFileUrl?: string | null;
  attachments?: Array<{
    path: string;
    name: string;
    size: number;
    mimeType: string;
    signedUrl?: string | null;
  }>;
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
  classId?: string | null;
  className?: string | null;
  updatedAt: string;
  downloads: number;
  type: "pdf" | "video" | "rich-note";
  body?: string | null;
  externalUrl?: string | null;
  fileUrl?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  originalFilename?: string | null;
  ownerProfileId?: string | null;
  ownedByStudent?: boolean;
  visibility?: "private" | "class" | "organization";
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
