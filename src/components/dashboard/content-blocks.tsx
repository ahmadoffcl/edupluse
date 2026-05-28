import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  Flame,
  LockKeyhole,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  bestNextFeatures,
  quickActions,
  securityControls,
} from "@/lib/mock-data";
import {
  urbanPrimeEmptyAnimations,
  type UrbanPrimeEmptyAnimation,
} from "@/lib/empty-state-assets";
import type {
  Activity,
  Assignment,
  AssignmentStatus,
  LeaderboardEntry,
  MessageThread,
  Note,
  ScheduleItem,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<
  AssignmentStatus,
  "default" | "secondary" | "success" | "warning" | "danger" | "info"
> = {
  pending: "warning",
  submitted: "info",
  graded: "success",
  late: "danger",
};

const emptyStateAnimations: Record<string, UrbanPrimeEmptyAnimation> = {
  schedule: "noResults",
  assignments: "feedback",
  notes: "reviews",
  messages: "noChat",
  leaderboard: "loader",
  activity: "loader",
  risk: "feedback",
};

const setupSuggestions = [
  "Invite teachers and students",
  "Create classes and sections",
  "Publish assignments and resources",
  "Review attendance and engagement",
  "Configure AI and security guardrails",
];

export function EmptyState({
  message,
  variant = "schedule",
}: {
  message: string;
  variant?: keyof typeof emptyStateAnimations;
}) {
  const animation = urbanPrimeEmptyAnimations[emptyStateAnimations[variant]];

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-dashed border-border bg-background/45 p-4 text-center sm:rounded-3xl sm:p-5">
      <div className="mx-auto mb-3 grid size-24 place-items-center rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(124,156,255,0.18),transparent_62%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:mb-4 sm:size-32 sm:rounded-[2rem]">
        <LottieAnimation
          src={animation}
          alt="Empty state animation"
          className="block size-20 sm:size-28"
        />
      </div>
      <p className="mx-auto max-w-sm text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
        {message}
      </p>
    </div>
  );
}

export function SchedulePanel({ items }: { items: ScheduleItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Schedule</CardTitle>
        <CardDescription>
          Live classes, exams, events, and study blocks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <EmptyState
            variant="schedule"
            message="No schedule records available yet."
          />
        )}
        {items.map((item) => (
          <div
            key={`${item.time}-${item.title}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-background/55 p-4"
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/12 font-mono text-sm font-semibold text-primary">
              {item.time}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.meta}</p>
            </div>
            <Badge variant={item.kind === "exam" ? "warning" : "default"}>
              {item.kind}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AssignmentsPanel({
  teacher = false,
  items,
}: {
  teacher?: boolean;
  items: Assignment[];
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>
            {teacher ? "Assignment Manager" : "Assignments"}
          </CardTitle>
          <CardDescription>
            {teacher
              ? "Create, review, and grade class work."
              : "Track deadlines, submissions, and teacher feedback."}
          </CardDescription>
        </div>
        <Button asChild size="sm" variant={teacher ? "default" : "outline"}>
          <Link
            href={teacher ? "/teacher/assignments" : "/student/assignments"}
          >
            {teacher ? "Create" : "Submit"}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <EmptyState
            variant="assignments"
            message="No assignments available yet."
          />
        )}
        {items.map((assignment) => (
          <div
            key={assignment.id}
            className="rounded-2xl border border-border bg-background/55 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{assignment.title}</p>
                <p className="text-sm text-muted-foreground">
                  {assignment.subject} - {assignment.className} - due{" "}
                  {formatDate(assignment.dueDate)}
                </p>
              </div>
              <Badge variant={statusVariant[assignment.status]}>
                {assignment.status}
              </Badge>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Progress
                value={
                  assignment.totalStudents
                    ? ((assignment.submittedBy ?? 0) /
                        assignment.totalStudents) *
                      100
                    : assignment.status === "graded"
                      ? 100
                      : 60
                }
              />
              <span className="w-20 text-right text-sm text-muted-foreground">
                {teacher
                  ? `${assignment.submittedBy}/${assignment.totalStudents}`
                  : `${assignment.points} XP`}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function NotesPanel({
  teacher = false,
  items,
}: {
  teacher?: boolean;
  items: Note[];
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{teacher ? "Resource Library" : "Recent Notes"}</CardTitle>
          <CardDescription>
            Searchable notes, PDFs, videos, and rich lesson material.
          </CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={teacher ? "/teacher/uploads" : "/student/notes"}>
            {teacher ? <UploadCloud /> : <Download />}
            {teacher ? "Upload" : "PDFs"}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <EmptyState
            variant="notes"
            message="No notes or resources available yet."
          />
        )}
        {items.map((note) => (
          <div
            key={note.id}
            className="flex items-center gap-4 rounded-2xl border border-border bg-background/55 p-4"
          >
            <div className="grid size-11 place-items-center rounded-2xl bg-blue-500/12 text-blue-500">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{note.title}</p>
              <p className="text-sm text-muted-foreground">
                {note.subject} - {note.type} - {note.downloads} downloads
              </p>
            </div>
            <Badge variant="secondary">{formatDate(note.updatedAt)}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function GamificationPanel({
  totalXp = 0,
  streak = 0,
  challenges = "0/0",
}: {
  totalXp?: number;
  streak?: number;
  challenges?: string;
}) {
  const level = Math.max(1, Math.floor(Math.sqrt(totalXp / 120)) + 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Motivation Engine</CardTitle>
        <CardDescription>
          XP, streaks, badges, and challenge completion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Level {level}</p>
              <p className="text-3xl font-semibold">
                {totalXp.toLocaleString()} XP
              </p>
            </div>
            <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Trophy className="size-7" />
            </div>
          </div>
          <Progress
            value={totalXp ? Math.min(100, totalXp % 100) : 0}
            className="mt-5"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Updated from learning activity
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-background/55 p-4">
            <Flame className="mb-3 size-5 text-amber-500" />
            <p className="text-2xl font-semibold">{streak}</p>
            <p className="text-sm text-muted-foreground">day streak</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/55 p-4">
            <CheckCircle2 className="mb-3 size-5 text-emerald-500" />
            <p className="text-2xl font-semibold">{challenges}</p>
            <p className="text-sm text-muted-foreground">challenges done</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LeaderboardPanel({ items }: { items: LeaderboardEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>
          Polished and motivational, without feeling childish.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <EmptyState
            variant="leaderboard"
            message="No XP leaderboard data available yet."
          />
        )}
        {items.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center gap-4 rounded-2xl border border-border bg-background/55 p-4"
          >
            <div className="grid size-10 place-items-center rounded-full bg-accent/20 font-mono font-bold text-accent">
              {entry.rank}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{entry.name}</p>
              <p className="text-sm text-muted-foreground">{entry.badge}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{entry.points.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                {entry.streak} days
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function MessagesPanel({ items }: { items: MessageThread[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
        <CardDescription>
          Teacher-student chat, class channels, and threads.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <EmptyState
            variant="messages"
            message="No message records available yet."
          />
        )}
        {items.map((message) => (
          <div
            key={message.id}
            className="flex items-center gap-4 rounded-2xl border border-border bg-background/55 p-4"
          >
            <div className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
              <MessageSquare className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{message.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {message.preview}
              </p>
            </div>
            {message.unread > 0 && (
              <Badge variant="default">{message.unread}</Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ActivityPanel({ items }: { items: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Activity</CardTitle>
        <CardDescription>
          Realtime notifications and achievement unlocks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <EmptyState
            variant="activity"
            message="No notification or activity records available yet."
          />
        )}
        {items.map((activity) => (
          <div
            key={activity.title}
            className="flex items-center gap-4 rounded-2xl border border-border bg-background/55 p-4"
          >
            <div className="grid size-10 place-items-center rounded-2xl bg-primary/12 text-primary">
              <CalendarClock className="size-5" />
            </div>
            <div>
              <p className="font-semibold">{activity.title}</p>
              <p className="text-sm text-muted-foreground">{activity.meta}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function QuickActionsPanel({
  role,
}: {
  role: "student" | "teacher" | "admin";
}) {
  const hrefs: Record<"student" | "teacher" | "admin", string[]> = {
    student: [
      "/student/notes",
      "/student/assignments",
      "/student",
      "/student/calendar",
    ],
    teacher: [
      "/teacher/classes",
      "/teacher/assignments",
      "/teacher/uploads",
      "/teacher/messages",
    ],
    admin: [
      "/admin/invites",
      "/admin/moderation",
      "/admin/reports",
      "/admin/security",
    ],
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Smart Quick Actions</CardTitle>
        <CardDescription>
          High-frequency workflows stay one tap away on desktop and mobile.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {quickActions[role].map((action, index) => (
          <Button
            key={action}
            asChild
            variant="outline"
            className="justify-start"
          >
            <Link href={hrefs[role][index] ?? `/${role}`}>
              <Sparkles className="text-primary" />
              {action}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

export function RiskRadarPanel({
  items,
}: {
  items: Array<{ label: string; count: number; severity: "high" | "medium" }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Radar</CardTitle>
        <CardDescription>
          Early warning signals for intervention and weak-student detection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <EmptyState
            variant="risk"
            message="No risk signals available until attendance and assignment activity grows."
          />
        )}
        {items.map((signal) => (
          <div
            key={signal.label}
            className="flex items-center gap-4 rounded-2xl border border-border bg-background/55 p-4"
          >
            <div className="grid size-10 place-items-center rounded-2xl bg-amber-500/12 text-amber-500">
              <AlertTriangle className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{signal.label}</p>
              <p className="text-sm text-muted-foreground">
                {signal.severity} priority intervention queue
              </p>
            </div>
            <Badge variant={signal.severity === "high" ? "warning" : "info"}>
              {signal.count}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function OnboardingPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Institute Onboarding</CardTitle>
        <CardDescription>
          Practical setup prompts for launching each school or academy tenant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mt-4 space-y-3">
          {setupSuggestions.map((step) => (
            <div key={step} className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              <span className="font-medium">{step}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SecurityCommandPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          Security Command Center
        </CardTitle>
        <CardDescription>
          Defense-in-depth controls that prevent route, API, records, and file
          access bypass.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {securityControls.map((control) => (
          <div
            key={control.title}
            className="flex items-center gap-4 rounded-2xl border border-border bg-background/55 p-4"
          >
            <div className="grid size-10 place-items-center rounded-2xl bg-primary/12 text-primary">
              <LockKeyhole className="size-5" />
            </div>
            <p className="flex-1 font-semibold">{control.title}</p>
            <Badge
              variant={
                control.tone as "success" | "warning" | "info" | "secondary"
              }
            >
              {control.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function BestNextFeaturesPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="size-5 text-primary" />
          Best Next Features
        </CardTitle>
        <CardDescription>
          High-impact roadmap ideas for making EduPulse more defensible and
          addictive in a healthy way.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {bestNextFeatures.map((feature) => (
          <div
            key={feature}
            className="rounded-2xl border border-border bg-background/55 p-4 text-sm font-medium leading-6"
          >
            {feature}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
