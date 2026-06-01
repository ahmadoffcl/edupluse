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
      <div className="relative h-28 overflow-visible bg-[#33474f] sm:h-32">
        {bannerUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url(${bannerUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.48),transparent_30%),radial-gradient(circle_at_78%_12%,rgba(168,85,247,0.42),transparent_28%),radial-gradient(circle_at_56%_86%,rgba(251,191,36,0.25),transparent_31%),linear-gradient(135deg,#030712,#111827_48%,#18181b)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/18 to-black/5" />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
          <Badge className="max-w-[62%] truncate rounded-full border-white/30 bg-white/18 text-white">
            {roleLabel}
          </Badge>
          {deadline ? (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-white/15 bg-black/28 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md sm:gap-1.5 sm:px-3 sm:text-xs">
              <CalendarClock className="size-3.5" />
              <span className="truncate">{deadline}</span>
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-4 left-4 right-20 text-white">
          <h3 className="line-clamp-2 text-lg font-medium tracking-[-0.03em] sm:text-2xl">
            {name}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs font-medium text-white/88">
            {teacherName || roleLabel}
          </p>
        </div>
        <span className="absolute -bottom-9 right-5 grid size-[4.5rem] place-items-center overflow-hidden rounded-full border-4 border-white bg-[#ec407a] text-2xl font-medium text-white shadow-[0_8px_24px_rgba(60,64,67,0.18)]">
          {initials(teacherName || roleLabel)}
        </span>
      </div>

      <div className="flex min-h-36 flex-1 flex-col justify-between gap-3 p-4 pt-12">
        <div>
          <p className="line-clamp-2 min-h-10 text-sm leading-5 text-[#5f6368]">
            {description || meta || teacherCaption}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.slice(0, 3).map((stat) => (
              <span
                key={stat.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#e1e7ef] bg-[#f8fafd] px-2.5 py-1 text-[11px] font-medium text-[#3c4043]"
              >
                {stat.label}
                <span className="font-semibold text-[#0b57d0]">
                  {stat.value}
                </span>
              </span>
            ))}
          </div>
        </div>

        {action ? <div>{action}</div> : null}
      </div>

      {href ? (
        <div className="flex h-14 items-center justify-end gap-2 border-t border-[#e1e7ef] px-4">
          {stats.slice(0, 3).map((stat) => {
            const Icon = stat.icon ? iconMap[stat.icon] : ClipboardList;
            return (
              <span
                key={stat.label}
                className="grid size-9 place-items-center rounded-full text-[#3c4043] transition group-hover:bg-[#f1f3f4]"
                title={stat.label}
              >
                <Icon className="size-5" />
              </span>
            );
          })}
          <span className="grid size-9 place-items-center rounded-full text-[#3c4043] transition group-hover:bg-[#f1f3f4]">
            <ChevronRight className="size-5" />
          </span>
        </div>
      ) : null}
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
          className="group flex h-full min-h-[292px] max-w-full flex-col overflow-hidden rounded-[0.85rem] border border-[#dadce0] bg-white shadow-[0_8px_26px_rgba(60,64,67,0.1)] transition hover:border-[#c7cdd6] hover:shadow-[0_14px_36px_rgba(60,64,67,0.16)]"
        >
          {body}
        </Link>
      ) : (
        <div className="group flex h-full min-h-[292px] max-w-full flex-col overflow-hidden rounded-[0.85rem] border border-[#dadce0] bg-white shadow-[0_8px_26px_rgba(60,64,67,0.1)] transition hover:border-[#c7cdd6] hover:shadow-[0_14px_36px_rgba(60,64,67,0.16)]">
          {body}
        </div>
      )}
    </motion.div>
  );
}
