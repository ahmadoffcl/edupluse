"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  HelpCircle,
  Home,
  KeyRound,
  Link2,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
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
  const router = useRouter();
  const { logout, user } = useAuth();
  const homeHref = role === "teacher" ? "/teacher" : "/student";
  const calendarHref =
    role === "teacher" ? "/teacher/calendar" : "/student/calendar";
  const settingsHref =
    role === "teacher" ? "/teacher/settings" : "/student/settings";
  const classesHref =
    role === "teacher" ? "/teacher/classes" : "/student/classes";
  const initial = (userName || "S").trim().charAt(0).toUpperCase() || "S";
  const activePath = currentPath ?? homeHref;
  const studentNavItems: Array<{
    href: string;
    label: string;
    icon: ReactNode;
    matchPath?: string;
  }> = [
    { href: homeHref, label: "Home", icon: <Home /> },
    { href: classesHref, label: "Classes", icon: <BookOpen /> },
    { href: "/student/upcoming", label: "Upcoming", icon: <Clock3 /> },
    {
      href: "/student/assignments",
      label: "Assignments",
      icon: <ClipboardList />,
    },
    { href: "/student/notes", label: "Notes", icon: <FileText /> },
    { href: calendarHref, label: "Calendar", icon: <CalendarDays /> },
    { href: "/student/messages", label: "Messages", icon: <MessageSquare /> },
    { href: "/student/analytics", label: "Analytics", icon: <BarChart3 /> },
    { href: "/student/leaderboard", label: "Leaderboard", icon: <Trophy /> },
    {
      href: `${classesHref}?filter=archived`,
      label: "Archived classes",
      icon: <Archive />,
    },
    { href: settingsHref, label: "Settings", icon: <Settings /> },
  ];
  const teacherNavItems: Array<{
    href: string;
    label: string;
    icon: ReactNode;
    matchPath?: string;
  }> = [
    { href: homeHref, label: "Home", icon: <Home /> },
    { href: classesHref, label: "Classes", icon: <BookOpen /> },
    { href: "/teacher/assignments", label: "Assignments", icon: <ClipboardList /> },
    { href: "/teacher/uploads", label: "Materials", icon: <FileText /> },
    { href: "/teacher/messages", label: "Messages", icon: <MessageSquare /> },
    { href: "/teacher/analytics", label: "Analytics", icon: <BarChart3 /> },
    { href: settingsHref, label: "Settings", icon: <Settings /> },
  ];
  const navItems = role === "student" ? studentNavItems : teacherNavItems;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [joining, setJoining] = useState(false);
  const mobilePriorityItems =
    role === "student"
      ? studentNavItems.filter((item) =>
          [homeHref, classesHref, "/student/upcoming", "/student/assignments"].includes(
            item.href,
          ),
        )
      : teacherNavItems.filter((item) =>
          [homeHref, classesHref, "/teacher/assignments", "/teacher/uploads"].includes(
            item.href,
          ),
        );
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

  async function joinClassByCode() {
    if (!classCode.trim()) return;
    setJoining(true);
    try {
      const response = await fetch("/api/student/classes/join-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: classCode.trim() }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        className?: string;
        error?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to join this class.");
      }

      toast.success("Class joined", {
        description: result?.className ?? "Your classroom is ready.",
      });
      setClassCode("");
      setJoinOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("Join failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setJoining(false);
    }
  }

  function openInviteUrl() {
    const value = inviteUrl.trim();
    if (!value) return;

    try {
      const url = new URL(value, window.location.origin);
      if (!url.pathname.startsWith("/invite/")) {
        toast.error("Invite link is not valid", {
          description: "Paste the classroom invite link your teacher shared.",
        });
        return;
      }
      setInviteUrl("");
      setJoinOpen(false);
      router.push(`${url.pathname}${url.search}`);
    } catch {
      toast.error("Invite link is not valid", {
        description: "Paste the full invite link or use a class code.",
      });
    }
  }

  return (
    <section
      className="fixed inset-0 z-[200] overflow-hidden bg-[#f5f8fc] text-[#202124] antialiased dark:bg-[#f5f8fc] dark:text-[#202124]"
      style={lightScope}
    >
      <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center rounded-b-[1.35rem] border-b border-[#e8eaed] bg-white px-5 shadow-[0_6px_24px_rgba(60,64,67,0.08)]">
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full text-[#3c4043] transition hover:bg-[#f1f3f4]"
          aria-label="Open navigation"
          onClick={() => setMobileMenuOpen(true)}
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
          {topAction ??
            (role === "student" ? (
              <button
                type="button"
                onClick={() => setJoinOpen(true)}
                className="grid size-10 place-items-center rounded-full text-[#3c4043] transition hover:bg-[#f1f3f4]"
                aria-label="Join class"
              >
                <Plus className="size-5" />
              </button>
            ) : (
              <Link
                href={classesHref}
                className="grid size-10 place-items-center rounded-full text-[#3c4043] transition hover:bg-[#f1f3f4]"
                aria-label="Create class"
              >
                <Plus className="size-5" />
              </Link>
            ))}
          <button
            type="button"
            onClick={() => setProfileOpen((value) => !value)}
            className="relative grid size-9 place-items-center overflow-hidden rounded-full bg-[#5f63d8] text-sm font-medium text-white ring-2 ring-transparent transition hover:ring-[#d2e3fc]"
            aria-label="Open profile"
          >
            {userPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="size-full object-cover" src={userPhotoUrl} />
            ) : (
              initial
            )}
          </button>
          {profileOpen ? (
            <div className="absolute right-4 top-[4.5rem] z-50 w-[min(92vw,20rem)] rounded-[1.5rem] border border-[#e1e7ef] bg-white p-3 text-[#202124] shadow-[0_18px_50px_rgba(60,64,67,0.22)]">
              <div className="flex items-center gap-3 rounded-2xl bg-[#f8fafd] p-3">
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#5f63d8] text-base font-medium text-white">
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
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {user?.displayName ?? userName ?? "EduPulse user"}
                  </span>
                  <span className="block truncate text-xs capitalize text-[#5f6368]">
                    {role}
                  </span>
                </span>
              </div>
              <div className="mt-2 space-y-1">
                <Link
                  href={settingsHref}
                  onClick={() => setProfileOpen(false)}
                  className="flex h-11 items-center justify-between rounded-2xl px-3 text-sm font-medium hover:bg-[#f1f3f4]"
                >
                  <span className="flex items-center gap-3">
                    <UserRound className="size-4" /> Profile settings
                  </span>
                  <ChevronRight className="size-4 text-[#5f6368]" />
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-medium hover:bg-[#f1f3f4]"
                >
                  <LogOut className="size-4" /> Sign out
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-16 z-10 hidden w-[300px] overflow-hidden rounded-r-[1.6rem] border-r border-[#e6ebf2] bg-[#f8fafd] pt-3 shadow-[8px_0_28px_rgba(60,64,67,0.06)] md:block">
        <nav className="h-full space-y-1 overflow-y-auto px-3 pb-6">
          {navItems.map((item) => {
            return (
              <ClassroomNavItem
                key={item.href}
                active={isClassroomNavActive(activePath, item.href, homeHref, item.matchPath)}
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
          "classroom-shell-main h-screen overflow-y-auto scroll-pt-24 pb-24 pt-20 md:pb-6 md:pl-[300px]",
          className,
        )}
      >
        {children}
      </main>

      <nav className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-30 grid grid-cols-5 rounded-[1.75rem] border border-[#e1e7ef] bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(60,64,67,0.18)] backdrop-blur-xl md:hidden">
        {mobilePriorityItems.map((item) => (
          <ClassroomMobileNavItem
            key={item.href}
            active={isClassroomNavActive(
              activePath,
              item.href,
              homeHref,
              item.matchPath,
            )}
            href={item.href}
            icon={item.icon}
          >
            {item.label}
          </ClassroomMobileNavItem>
        ))}
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileMenuOpen(true)}
          className="grid min-h-14 place-items-center rounded-[1.25rem] px-1 text-[#5f6368] transition hover:bg-[#eef3f8]"
        >
          <Menu className="size-5" />
          <span className="mt-0.5 text-[10px] font-medium leading-none">
            Menu
          </span>
        </button>
      </nav>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/25"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-hidden rounded-t-[2rem] border border-[#e1e7ef] bg-white shadow-[0_-18px_52px_rgba(60,64,67,0.2)]">
            <div className="flex items-center justify-between border-b border-[#edf0f4] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-[8px] bg-[#16a765] text-white">
                  <UsersRound className="size-4" />
                </span>
                <div>
                  <p className="font-medium text-[#202124]">Classroom</p>
                  <p className="text-xs text-[#5f6368]">
                    {role === "student" ? "Student workspace" : "Teacher workspace"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                className="grid size-10 place-items-center rounded-full text-[#3c4043] hover:bg-[#f1f3f4]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="max-h-[calc(82vh-73px)] space-y-1 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex h-12 items-center gap-4 rounded-2xl px-4 text-sm font-medium text-[#202124] transition hover:bg-[#eef3f8]",
                    isClassroomNavActive(
                      activePath,
                      item.href,
                      homeHref,
                      item.matchPath,
                    ) && "bg-[#c2e7ff] text-[#0b57d0]",
                  )}
                >
                  <span className="grid size-6 place-items-center [&_svg]:size-5">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      {joinOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 backdrop-blur-md">
          <button
            type="button"
            aria-label="Close join class"
            className="absolute inset-0"
            onClick={() => setJoinOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-[2rem] border border-white/65 bg-white/88 p-5 text-[#202124] shadow-[0_28px_90px_rgba(15,23,42,0.32)] backdrop-blur-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b57d0]">
                  Join classroom
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  Enter a class code or invite link.
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#5f6368]">
                  Use the code or invite URL shared by your teacher. You will be
                  added instantly when the invite allows direct join.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setJoinOpen(false)}
                className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-[#f1f3f4]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="size-4 text-[#0b57d0]" /> Class code
                </span>
                <input
                  value={classCode}
                  onChange={(event) => setClassCode(event.target.value)}
                  placeholder="Example: OOP-2B"
                  className="h-12 w-full rounded-2xl border border-[#dadce0] bg-white px-4 text-sm outline-none transition focus:border-[#0b57d0] focus:ring-4 focus:ring-[#d2e3fc]"
                />
              </label>
              <button
                type="button"
                disabled={joining || !classCode.trim()}
                onClick={joinClassByCode}
                className="h-12 w-full rounded-2xl bg-[#0b57d0] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(11,87,208,0.25)] transition hover:bg-[#0842a0] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {joining ? "Joining..." : "Join with code"}
              </button>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs font-medium text-[#5f6368]">
              <span className="h-px flex-1 bg-[#e1e7ef]" />
              or
              <span className="h-px flex-1 bg-[#e1e7ef]" />
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Link2 className="size-4 text-[#0b57d0]" /> Invite URL
                </span>
                <input
                  value={inviteUrl}
                  onChange={(event) => setInviteUrl(event.target.value)}
                  placeholder="Paste classroom invite link"
                  className="h-12 w-full rounded-2xl border border-[#dadce0] bg-white px-4 text-sm outline-none transition focus:border-[#0b57d0] focus:ring-4 focus:ring-[#d2e3fc]"
                />
              </label>
              <button
                type="button"
                disabled={!inviteUrl.trim()}
                onClick={openInviteUrl}
                className="h-12 w-full rounded-2xl border border-[#dadce0] bg-white text-sm font-semibold text-[#202124] transition hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-55"
              >
                Open invite
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Link
        href="/support"
        className="fixed bottom-28 right-5 z-20 hidden size-8 place-items-center rounded-full text-[#3c4043] transition hover:bg-[#f1f3f4] md:grid md:bottom-6 md:right-6"
        aria-label="Help"
      >
        <HelpCircle className="size-5" />
      </Link>
    </section>
  );
}

function isClassroomNavActive(
  activePath: string,
  href: string,
  homeHref: string,
  matchPath?: string,
) {
  const target = matchPath ?? href.split("?")[0];

  if (target === homeHref) return activePath === homeHref;
  return activePath === target || activePath.startsWith(`${target}/`);
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

function ClassroomMobileNavItem({
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
        "grid min-h-14 place-items-center rounded-[1.25rem] px-1 text-[#5f6368] transition hover:bg-[#eef3f8]",
        active && "bg-[#0b57d0] text-white shadow-[0_10px_24px_rgba(11,87,208,0.25)]",
      )}
    >
      <span className="[&_svg]:size-5">{icon}</span>
      <span className="mt-0.5 max-w-full truncate text-[10px] font-medium leading-none">
        {children}
      </span>
    </Link>
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
