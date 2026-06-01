"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Megaphone,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, initials } from "@/lib/utils";

export type ClassroomCardStat = {
  label: string;
  value: string | number;
  icon?: "assignments" | "materials" | "posts" | "people";
};

const iconMap = {
  assignments: ClipboardList,
  materials: BookOpen,
  posts: Megaphone,
  people: UsersRound,
} satisfies Record<NonNullable<ClassroomCardStat["icon"]>, typeof BookOpen>;

function formatDeadline(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

export function ClassroomCard({
  href,
  name,
  description,
  bannerUrl,
  teacherName,
  section,
  term,
  roleLabel = "Classroom",
  stats,
  nextDeadline,
  action,
  className,
}: {
  href?: string;
  name: string;
  description?: string | null;
  bannerUrl?: string | null;
  teacherName?: string | null;
  section?: string | null;
  term?: string | null;
  roleLabel?: string;
  stats: ClassroomCardStat[];
  nextDeadline?: string | null;
  action?: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const deadline = formatDeadline(nextDeadline);
  const meta = [section, term].filter(Boolean).join(" - ") || roleLabel;
  const teacherCaption = teacherName?.includes("co-teacher")
    ? "Teaching team"
    : "Class owner";
  const body = (
    <>
      <div className="relative h-28 overflow-hidden bg-[#070a12] sm:h-40">
        {bannerUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url(${bannerUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.48),transparent_30%),radial-gradient(circle_at_78%_12%,rgba(168,85,247,0.42),transparent_28%),radial-gradient(circle_at_56%_86%,rgba(251,191,36,0.25),transparent_31%),linear-gradient(135deg,#030712,#111827_48%,#18181b)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/28 to-black/10" />
        <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
          <Badge className="max-w-[62%] truncate border-white/15 bg-white/12 text-white">
            {meta}
          </Badge>
          {deadline ? (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-white/15 bg-black/28 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md sm:gap-1.5 sm:px-3 sm:text-xs">
              <CalendarClock className="size-3.5" />
              <span className="truncate">{deadline}</span>
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-3 left-3 right-3 text-white sm:bottom-4 sm:left-4 sm:right-4">
          <h3 className="line-clamp-2 text-base font-semibold tracking-tight sm:text-xl">
            {name}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-white/70">
            {description || "Open the classroom workspace"}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-bold text-primary">
              {initials(teacherName || roleLabel)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {teacherName || roleLabel}
              </span>
              <span className="block text-xs text-muted-foreground">
                {teacherCaption}
              </span>
            </span>
          </div>
          {href ? (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
              <ChevronRight className="size-4" />
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {stats.slice(0, 3).map((stat) => {
            const Icon = stat.icon ? iconMap[stat.icon] : ClipboardList;
            return (
              <div
                key={stat.label}
                className="min-w-0 rounded-xl border border-border bg-background/58 p-1.5 sm:rounded-2xl sm:p-3"
              >
                <Icon className="mb-1 size-3.5 text-primary sm:mb-2 sm:size-4" />
                <p className="truncate text-xs font-semibold sm:text-base">
                  {stat.value}
                </p>
                <p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                  {stat.label}
                </p>
              </div>
            );
          })}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </>
  );

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -6, scale: 1.01 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={cn("h-full", className)}
    >
      {href ? (
        <Link
          href={href}
          className="group flex h-full min-h-[238px] max-w-full flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-card/86 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.85)] ring-1 ring-border/70 backdrop-blur-xl transition sm:min-h-[310px] sm:rounded-[2rem]"
        >
          {body}
        </Link>
      ) : (
        <div className="group flex h-full min-h-[238px] max-w-full flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-card/86 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.85)] ring-1 ring-border/70 backdrop-blur-xl transition sm:min-h-[310px] sm:rounded-[2rem]">
          {body}
        </div>
      )}
    </motion.div>
  );
}
