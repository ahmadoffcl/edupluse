"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  CalendarDays,
  HelpCircle,
  Home,
  Menu,
  Plus,
  Settings,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ClassroomHomeFrame({
  children,
  className,
  role = "student",
  userName = "S",
  userPhotoUrl,
  topAction,
  currentPath,
}: {
  children: ReactNode;
  className?: string;
  role?: "student" | "teacher";
  userName?: string | null;
  userPhotoUrl?: string | null;
  topAction?: ReactNode;
  currentPath?: string;
}) {
  const homeHref = role === "teacher" ? "/teacher" : "/student";
  const calendarHref =
    role === "teacher" ? "/teacher/calendar" : "/student/calendar";
  const settingsHref =
    role === "teacher" ? "/teacher/settings" : "/student/settings";
  const classesHref =
    role === "teacher" ? "/teacher/classes" : "/student/classes";
  const initial = (userName || "S").trim().charAt(0).toUpperCase() || "S";
  const activePath = currentPath ?? homeHref;
  const navItems: Array<{
    href: string;
    label: string;
    icon: ReactNode;
    matchPath?: string;
  }> = [
    { href: homeHref, label: "Home", icon: <Home /> },
    { href: calendarHref, label: "Calendar", icon: <CalendarDays /> },
    {
      href: `${classesHref}?filter=archived`,
      label: "Archived classes",
      icon: <Archive />,
    },
    { href: settingsHref, label: "Settings", icon: <Settings /> },
  ];
  const lightScope = {
    "--background": "#ffffff",
    "--foreground": "#202124",
    "--card": "#ffffff",
    "--card-foreground": "#202124",
    "--popover": "#ffffff",
    "--popover-foreground": "#202124",
    "--muted": "#f1f3f4",
    "--muted-foreground": "#5f6368",
    "--border": "#dadce0",
    "--primary": "#0b57d0",
    "--primary-foreground": "#ffffff",
  } as CSSProperties;

  return (
    <section
      className="fixed inset-0 z-[200] overflow-hidden bg-white text-[#202124] antialiased dark:bg-white dark:text-[#202124]"
      style={lightScope}
    >
      <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center border-b border-[#e8eaed] bg-white px-5">
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full text-[#3c4043] transition hover:bg-[#f1f3f4]"
          aria-label="Open navigation"
        >
          <Menu className="size-6" />
        </button>
        <Link
          href={homeHref}
          className="ml-4 flex items-center gap-3 text-[1.375rem] font-normal tracking-[-0.02em] text-[#3c4043]"
        >
          <span className="grid size-7 place-items-center rounded-[3px] bg-[#16a765] text-white ring-1 ring-[#0f8e53]">
            <UsersRound className="size-4" />
          </span>
          <span>Classroom</span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {topAction ?? (
            <Link
              href={classesHref}
              className="grid size-10 place-items-center rounded-full text-[#3c4043] transition hover:bg-[#f1f3f4]"
              aria-label={role === "teacher" ? "Create class" : "Join class"}
            >
              <Plus className="size-5" />
            </Link>
          )}
          <span className="relative grid size-9 place-items-center overflow-hidden rounded-full bg-[#5f63d8] text-sm font-medium text-white">
            {userPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="size-full object-cover"
                src={userPhotoUrl}
              />
            ) : (
              initial
            )}
          </span>
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 z-10 w-[76px] border-r border-transparent bg-[#f8fafd] pt-3 md:w-[300px]">
        <nav className="space-y-4 px-3">
          {navItems.map((item) => {
            const matchPath = item.matchPath ?? item.href;
            const active =
              matchPath === homeHref
                ? activePath === homeHref
                : activePath === matchPath ||
                  activePath.startsWith(`${matchPath}/`);

            return (
              <ClassroomNavItem
                key={item.href}
                active={active}
                href={item.href}
                icon={item.icon}
              >
                {item.label}
              </ClassroomNavItem>
            );
          })}
        </nav>
      </aside>

      <main
        className={cn(
          "h-screen overflow-y-auto pl-[76px] pt-16 md:pl-[300px]",
          className,
        )}
      >
        {children}
      </main>

      <Link
        href="/support"
        className="fixed bottom-6 right-6 z-20 grid size-8 place-items-center rounded-full text-[#3c4043] transition hover:bg-[#f1f3f4]"
        aria-label="Help"
      >
        <HelpCircle className="size-5" />
      </Link>
    </section>
  );
}

export function ClassroomEmptyHome({
  title = "Add a class to get started",
  children,
  role = "student",
  userName,
  userPhotoUrl,
  topAction,
  currentPath,
}: {
  title?: string;
  children: ReactNode;
  role?: "student" | "teacher";
  userName?: string | null;
  userPhotoUrl?: string | null;
  topAction?: ReactNode;
  currentPath?: string;
}) {
  return (
    <ClassroomHomeFrame
      role={role}
      topAction={topAction}
      userName={userName}
      userPhotoUrl={userPhotoUrl}
      currentPath={currentPath}
    >
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-5 py-12 text-center">
        <img
          alt=""
          className="h-auto w-[min(230px,58vw)] select-none object-contain"
          src="/classroom-empty-state.png"
        />
        <p className="mt-8 text-sm font-normal text-[#202124]">
          {title}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-5">
          {children}
        </div>
      </div>
    </ClassroomHomeFrame>
  );
}

function ClassroomNavItem({
  active = false,
  children,
  href,
  icon,
}: {
  active?: boolean;
  children: ReactNode;
  href: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-12 items-center gap-5 rounded-full px-4 text-sm font-medium text-[#202124] transition hover:bg-[#eef3f8] md:h-12 md:px-4",
        active && "bg-[#c2e7ff] text-[#0b57d0] hover:bg-[#c2e7ff]",
      )}
    >
      <span className="grid size-6 shrink-0 place-items-center [&_svg]:size-5">
        {icon}
      </span>
      <span className="hidden md:inline">{children}</span>
    </Link>
  );
}
