"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Megaphone,
  Radio,
  Search,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/content-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { UpcomingTask } from "@/lib/dashboard/server-data";
import { cn } from "@/lib/utils";

const TASK_PAGE_SIZE = 12;

const kindMeta = {
  assignment: {
    label: "Assignment",
    alert: "Submission deadline",
    icon: ClipboardCheck,
    tone: "text-blue-600 bg-blue-500/12 dark:text-blue-300",
  },
  exam: {
    label: "Quiz / exam",
    alert: "Prepare before it starts",
    icon: Sparkles,
    tone: "text-amber-700 bg-amber-400/15 dark:text-amber-300",
  },
  event: {
    label: "Event",
    alert: "Major class event",
    icon: Megaphone,
    tone: "text-violet-600 bg-violet-500/12 dark:text-violet-300",
  },
  live: {
    label: "Live class",
    alert: "Join on time",
    icon: Radio,
    tone: "text-emerald-600 bg-emerald-500/12 dark:text-emerald-300",
  },
} satisfies Record<
  UpcomingTask["kind"],
  {
    label: string;
    alert: string;
    icon: typeof ClipboardCheck;
    tone: string;
  }
>;

const kindFilters = [
  { label: "All", value: "all" },
  { label: "Assignments", value: "assignment" },
  { label: "Quizzes", value: "exam" },
  { label: "Events", value: "event" },
  { label: "Live", value: "live" },
] satisfies Array<{ label: string; value: UpcomingTask["kind"] | "all" }>;

function dueDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysLeft(value: string) {
  const date = dueDate(value);
  if (!date) return null;

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfDueDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  return Math.ceil(
    (startOfDueDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function timeLeftLabel(value: string) {
  const days = daysLeft(value);
  if (days === null) return "Date not set";
  if (days < 0)
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

function formatDateTime(value: string) {
  const date = dueDate(value);
  if (!date) return "Date not set";

  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function urgencyVariant(task: UpcomingTask) {
  const days = daysLeft(task.dueAt);
  if (task.status === "late" || (days !== null && days < 0)) return "danger";
  if (days !== null && days <= 1) return "warning";
  if (task.kind === "exam") return "warning";
  if (task.kind === "live") return "success";
  return "info";
}

function TaskCard({
  task,
  priority = false,
}: {
  task: UpcomingTask;
  priority?: boolean;
}) {
  const meta = kindMeta[task.kind];
  const Icon = meta.icon;
  const actionLabel =
    task.kind === "exam"
      ? "Open quiz"
      : task.kind === "assignment"
        ? "Open assignment"
        : "Open";
  const days = daysLeft(task.dueAt);
  const urgent =
    task.kind === "exam" || task.kind === "live" || (days ?? 99) <= 2;

  return (
    <Card
      className={cn(
        "overflow-hidden transition hover:-translate-y-1 hover:shadow-xl",
        priority && "border-primary/30 bg-primary/5",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl",
              meta.tone,
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={urgencyVariant(task)}>{meta.label}</Badge>
              {urgent ? <Badge variant="warning">Notify</Badge> : null}
            </div>
            <h3 className="mt-2 line-clamp-2 text-base font-semibold tracking-tight">
              {task.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {task.className}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
          <div className="min-w-0 rounded-2xl border border-border bg-background/65 p-2.5 sm:p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="size-4 text-primary" />
              <span className="truncate">{timeLeftLabel(task.dueAt)}</span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {formatDateTime(task.dueAt)}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-border bg-background/65 p-2.5 sm:p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="size-4 text-primary" />
              <span className="truncate">{meta.alert}</span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {task.status === "late" ? "Needs attention now" : "Upcoming"}
            </p>
          </div>
        </div>

        <Button asChild className="mt-3 w-full" variant="outline">
          <Link href={task.href}>
            {actionLabel} <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function UpcomingTasksPanel({
  tasks,
  compact = false,
}: {
  tasks: UpcomingTask[];
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<UpcomingTask["kind"] | "all">("all");
  const [visibleCount, setVisibleCount] = useState(
    compact ? 4 : TASK_PAGE_SIZE,
  );

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesKind = kind === "all" || task.kind === kind;
      if (!matchesKind) return false;
      if (!normalized) return true;

      return [
        task.title,
        task.className,
        task.status,
        kindMeta[task.kind].label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [kind, query, tasks]);

  const visibleTasks = compact
    ? filteredTasks.slice(0, 4)
    : filteredTasks.slice(0, visibleCount);
  const nextTask = filteredTasks[0];
  const dueSoon = filteredTasks.filter((task) => {
    const days = daysLeft(task.dueAt);
    return days !== null && days >= 0 && days <= 3;
  }).length;
  const quizzes = filteredTasks.filter((task) => task.kind === "exam").length;
  const events = filteredTasks.filter(
    (task) => task.kind === "event" || task.kind === "live",
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Upcoming focus
          </h2>
          <p className="text-sm text-muted-foreground">
            Assignments, quizzes, live classes, and major events from your real
            classes.
          </p>
        </div>
        {compact ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/student/upcoming">
              Open focus center <ArrowRight />
            </Link>
          </Button>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          variant="schedule"
          message="No upcoming assignments, quizzes, or class events yet."
        />
      ) : null}

      {!compact && tasks.length > 0 ? (
        <Card className="sticky top-3 z-10 border-border/70 bg-card/88 backdrop-blur-xl lg:top-24">
          <CardContent className="grid gap-3 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search upcoming assignments, quizzes, and events"
                className="pl-11"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {kindFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setKind(filter.value)}
                  className={cn(
                    "inline-flex min-w-fit items-center rounded-full px-4 py-2 text-sm font-semibold transition",
                    kind === filter.value
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  {filter.label}
                </button>
              ))}
              <Badge variant="secondary" className="min-w-fit">
                {filteredTasks.length} item
                {filteredTasks.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tasks.length > 0 && filteredTasks.length === 0 ? (
        <EmptyState
          variant="schedule"
          message="No upcoming tasks match your search or filter."
        />
      ) : null}

      {!compact && nextTask ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <TaskCard task={nextTask} priority />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-primary" />
                Today focus
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                ["Due soon", dueSoon],
                ["Quiz / exam alerts", quizzes],
                ["Events and live classes", events],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between rounded-2xl border border-border bg-background/60 p-3"
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    {label}
                  </span>
                  <span className="text-xl font-semibold">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div
        className={
          compact
            ? "grid gap-4 lg:grid-cols-2"
            : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        }
      >
        {(compact ? visibleTasks : visibleTasks.slice(nextTask ? 1 : 0)).map(
          (task) => (
            <TaskCard key={`${task.kind}-${task.id}`} task={task} />
          ),
        )}
      </div>

      {!compact && filteredTasks.length > visibleTasks.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((count) => count + TASK_PAGE_SIZE)}
          >
            Load more tasks
          </Button>
        </div>
      ) : null}
    </div>
  );
}
