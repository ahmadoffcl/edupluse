"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  LogOut,
  Menu,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { roleNav } from "@/lib/mock-data";
import { canAccessPath, homeForRole } from "@/lib/permissions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
  actionUrl?: string | null;
  dedupeKey?: string | null;
};

type TimetableSessionItem = {
  id: string;
  slotId: string;
  className: string;
  subjectName: string;
  teacherName: string | null;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  startReminderAt: string;
  endReminderAt: string;
  actionUrl: string;
  dedupeStartKey: string;
  dedupeEndKey: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function classReminderBody(session: TimetableSessionItem) {
  const time = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(session.startsAt));

  return [session.venue, session.teacherName, time].filter(Boolean).join(" - ");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [openMobile, setOpenMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [smartLearningEnabled, setSmartLearningEnabled] = useState(false);
  const [routePending, setRoutePending] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [classAlertPromptVisible, setClassAlertPromptVisible] = useState(false);
  const [pushStatus, setPushStatus] = useState<
    "idle" | "saving" | "ready" | "unavailable"
  >("idle");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const notificationsLoadedRef = useRef(false);
  const routePendingTimerRef = useRef<number | null>(null);
  const mobileDrawerTouchStartRef = useRef<number | null>(null);
  const classReminderTimersRef = useRef<number[]>([]);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setRoutePending(false), 80);
    if (routePendingTimerRef.current) {
      window.clearTimeout(routePendingTimerRef.current);
      routePendingTimerRef.current = null;
    }
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(
    () => () => {
      if (routePendingTimerRef.current) {
        window.clearTimeout(routePendingTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!canAccessPath(user.role, pathname)) {
      router.replace(homeForRole(user.role));
    }
  }, [loading, pathname, router, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadFeatures() {
      try {
        const response = await fetch("/api/features", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as {
          flags?: { smartLearningEnabled?: boolean };
        } | null;
        if (!cancelled) {
          setSmartLearningEnabled(
            Boolean(payload?.flags?.smartLearningEnabled),
          );
        }
      } catch {
        if (!cancelled) setSmartLearningEnabled(false);
      }
    }
    void loadFeatures();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const nav = useMemo(() => {
    const items = roleNav[user?.role ?? "student"];
    if (smartLearningEnabled) return items;
    return items.filter((item) => item.href !== "/student/missions");
  }, [smartLearningEnabled, user?.role]);
  const searchItems = useMemo(
    () =>
      nav.map((item) => ({
        title: item.title,
        href: item.href,
        icon: item.icon,
        keywords: `${item.title} ${item.href}`.toLowerCase(),
      })),
    [nav],
  );
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return searchItems.slice(0, 6);

    return searchItems
      .filter((item) => item.keywords.includes(query))
      .slice(0, 6);
  }, [searchItems, searchQuery]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const timer = window.setTimeout(() => {
        setNotificationPermission(window.Notification.permission);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    async function loadNotifications() {
      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          notifications?: NotificationItem[];
        } | null;

        if (!cancelled) {
          const nextNotifications = payload?.notifications ?? [];
          setNotifications(nextNotifications);

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            window.Notification.permission === "granted"
          ) {
            const notifiedIds = new Set(
              (window.localStorage.getItem("edupulse.notified.ids") ?? "")
                .split(",")
                .filter(Boolean),
            );

            for (const item of nextNotifications) {
              const notificationKey = item.dedupeKey ?? item.id;
              if (
                !notificationsLoadedRef.current ||
                item.readAt ||
                notifiedIds.has(notificationKey)
              ) {
                notifiedIds.add(notificationKey);
                continue;
              }

              const browserNotification = new window.Notification(item.title, {
                body: item.body,
                tag: notificationKey,
              });
              browserNotification.onclick = () => {
                window.focus();
                if (item.actionUrl) router.push(item.actionUrl);
              };
              notifiedIds.add(notificationKey);
            }

            window.localStorage.setItem(
              "edupulse.notified.ids",
              Array.from(notifiedIds).slice(-200).join(","),
            );
          }

          notificationsLoadedRef.current = true;
        }
      } catch {
        if (!cancelled) setNotifications([]);
      }
    }

    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router, user]);

  useEffect(() => {
    if (!user?.orgId) return undefined;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return undefined;

    let cancelled = false;
    const refresh = () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = window.setTimeout(async () => {
        if (cancelled) return;
        router.refresh();
        try {
          const response = await fetch("/api/notifications", {
            cache: "no-store",
          });
          const payload = (await response.json().catch(() => null)) as {
            notifications?: NotificationItem[];
          } | null;
          if (!cancelled) setNotifications(payload?.notifications ?? []);
        } catch {
          // Polling remains the fallback if realtime refresh cannot load.
        }
      }, 450);
    };

    const channel = supabase.channel(`edupulse-live-${user.orgId}-${user.uid}`);
    for (const table of [
      "notifications",
      "assignments",
      "submissions",
      "resources",
      "announcements",
      "messages",
      "calendar_events",
      "class_join_requests",
      "enrollments",
    ]) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `org_id=eq.${user.orgId}`,
        },
        refresh,
      );
    }
    channel.subscribe();

    return () => {
      cancelled = true;
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [router, user?.orgId, user?.uid]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!user || notificationPermission !== "default") {
        setClassAlertPromptVisible(false);
        return;
      }

      const prompted = window.localStorage.getItem(
        "edupulse.classAlerts.prompted",
      );
      setClassAlertPromptVisible(prompted !== "true");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [notificationPermission, user]);

  useEffect(() => {
    classReminderTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    classReminderTimersRef.current = [];

    if (!user || user.role !== "student") return;

    let cancelled = false;
    const currentUser = user;

    function notifyLocal({
      key,
      title,
      body,
      actionUrl,
    }: {
      key: string;
      title: string;
      body: string;
      actionUrl: string;
    }) {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        window.Notification.permission !== "granted"
      ) {
        return;
      }

      const notifiedIds = new Set(
        (window.localStorage.getItem("edupulse.notified.ids") ?? "")
          .split(",")
          .filter(Boolean),
      );
      if (notifiedIds.has(key)) return;

      const browserNotification = new window.Notification(title, {
        body,
        tag: key,
      });
      browserNotification.onclick = () => {
        window.focus();
        router.push(actionUrl);
      };
      notifiedIds.add(key);
      window.localStorage.setItem(
        "edupulse.notified.ids",
        Array.from(notifiedIds).slice(-240).join(","),
      );
    }

    function scheduleSessions(sessions: TimetableSessionItem[]) {
      const now = Date.now();
      for (const session of sessions) {
        const reminders = [
          {
            key: session.dedupeStartKey,
            at: new Date(session.startReminderAt).getTime(),
            title: `${session.subjectName} starts in 15 min`,
            body: classReminderBody(session),
          },
          {
            key: session.dedupeEndKey,
            at: new Date(session.endReminderAt).getTime(),
            title: `${session.subjectName} is ending now`,
            body: classReminderBody(session),
          },
        ];

        for (const reminder of reminders) {
          const delay = reminder.at - now;
          if (delay < -30 * 60 * 1000) continue;
          if (delay <= 0) {
            notifyLocal({
              key: reminder.key,
              title: reminder.title,
              body: reminder.body,
              actionUrl: session.actionUrl,
            });
            continue;
          }
          if (delay > 24 * 60 * 60 * 1000) continue;

          const timer = window.setTimeout(() => {
            notifyLocal({
              key: reminder.key,
              title: reminder.title,
              body: reminder.body,
              actionUrl: session.actionUrl,
            });
          }, delay);
          classReminderTimersRef.current.push(timer);
        }
      }
    }

    async function loadTimetable() {
      const cacheKey = `edupulse.timetable.${currentUser.uid}`;
      try {
        const response = await fetch("/api/student/timetable", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          sessions?: TimetableSessionItem[];
        } | null;
        const sessions = payload?.sessions ?? [];
        if (cancelled) return;
        window.localStorage.setItem(cacheKey, JSON.stringify(sessions));
        scheduleSessions(sessions);
      } catch {
        const cached = window.localStorage.getItem(cacheKey);
        if (!cached || cancelled) return;
        try {
          scheduleSessions(JSON.parse(cached) as TimetableSessionItem[]);
        } catch {
          window.localStorage.removeItem(cacheKey);
        }
      }
    }

    void loadTimetable();
    const refresh = window.setInterval(loadTimetable, 30 * 60 * 1000);
    window.addEventListener("online", loadTimetable);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
      window.removeEventListener("online", loadTimetable);
      classReminderTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      );
      classReminderTimersRef.current = [];
    };
  }, [router, user]);

  async function enableDeviceNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setPushStatus("unavailable");
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
    window.localStorage.setItem("edupulse.classAlerts.prompted", "true");
    setClassAlertPromptVisible(false);

    if (permission !== "granted") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unavailable");
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      setPushStatus("unavailable");
      return;
    }

    setPushStatus("saving");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const readyRegistration = await navigator.serviceWorker.ready;
      const existing = await readyRegistration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await readyRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));

      const saveResponse = await fetch(
        "/api/notifications/push-subscriptions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        },
      );
      if (!saveResponse.ok) {
        const payload = (await saveResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to save device alerts.");
      }
      registration.update().catch(() => undefined);
      setPushStatus("ready");
    } catch {
      setPushStatus("unavailable");
    }
  }

  function openSearchResult(href: string) {
    setSearchOpen(false);
    setSearchQuery("");
    navigateTo(href);
  }

  function navigateTo(href: string) {
    if (href !== pathname) {
      setRoutePending(true);
      if (routePendingTimerRef.current) {
        window.clearTimeout(routePendingTimerRef.current);
      }
      routePendingTimerRef.current = window.setTimeout(() => {
        setRoutePending(false);
        routePendingTimerRef.current = null;
      }, 8_000);
      router.push(href);
    }
    setOpenMobile(false);
  }

  function onMobileDrawerTouchStart(event: React.TouchEvent<HTMLElement>) {
    mobileDrawerTouchStartRef.current = event.touches[0]?.clientX ?? null;
  }

  function onMobileDrawerTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const start = mobileDrawerTouchStartRef.current;
    mobileDrawerTouchStartRef.current = null;
    if (start === null) return;

    const end = event.changedTouches[0]?.clientX ?? start;
    if (start - end > 56) setOpenMobile(false);
  }

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  function navBadgeCount(href: string) {
    return notifications.filter((item) => {
      if (item.readAt || !item.actionUrl) return false;
      return item.actionUrl === href || item.actionUrl.startsWith(`${href}/`);
    }).length;
  }
  const currentRole = user?.role ?? "student";
  const mobilePriority = useMemo(() => {
    const byTitle = new Map(nav.map((item) => [item.title, item]));
    const preferred =
      currentRole === "student"
        ? ["Dashboard", "Classes", "Upcoming", "Assignments"]
        : currentRole === "teacher"
          ? ["Dashboard", "Classes", "Requests", "Assignments"]
          : ["Dashboard", "Users", "ID Maker", "Contact"];

    return preferred
      .map((title) => byTitle.get(title))
      .filter(Boolean)
      .slice(0, 4) as typeof nav;
  }, [currentRole, nav]);

  useEffect(() => {
    if (
      !user ||
      notificationPermission !== "granted" ||
      pushStatus !== "idle"
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void enableDeviceNotifications();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [notificationPermission, pushStatus, user]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="glass-panel flex w-full max-w-md items-center gap-4 rounded-3xl p-5">
          <div className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="size-5 animate-pulse" />
          </div>
          <div>
            <p className="font-semibold">Preparing EduPulse workspace</p>
            <p className="text-sm text-muted-foreground">
              Checking session, role, and organization access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const classroomHomeRoute =
    (pathname === "/student" && user.role === "student") ||
    (pathname === "/teacher" && user.role === "teacher");

  if (classroomHomeRoute) {
    return <>{children}</>;
  }

  const notificationDropdown = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative rounded-full"
        >
          <Bell />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {Math.min(unreadCount, 9)}
            </span>
          ) : null}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 mt-2 w-[min(calc(100vw-1rem),22rem)] rounded-3xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 p-3">
            <div>
              <p className="font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                Class alerts and returned work
              </p>
            </div>
            <Badge variant={unreadCount ? "warning" : "secondary"}>
              {unreadCount} new
            </Badge>
          </div>
          {notificationPermission === "default" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mx-3 mb-2 w-[calc(100%-1.5rem)]"
              onClick={enableDeviceNotifications}
            >
              <Bell /> Enable device alerts
            </Button>
          ) : null}
          <div className="max-h-80 space-y-2 overflow-y-auto p-1">
            {notifications.length === 0 ? (
              <div className="rounded-2xl bg-muted p-3 text-sm">
                <p className="font-medium">No notifications yet</p>
                <p className="text-xs text-muted-foreground">
                  Posts, grades, messages, and submission updates will appear
                  here.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-2xl border border-border bg-background/70 p-3 text-left text-sm transition hover:bg-muted"
                  onClick={() => {
                    if (item.actionUrl) {
                      navigateTo(item.actionUrl);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{item.title}</p>
                    <Badge variant="secondary">{item.kind}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.body}
                  </p>
                </button>
              ))
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

  return (
    <div className="min-h-screen">
      <div className="premium-grid pointer-events-none fixed inset-x-0 top-0 h-[360px]" />
      {openMobile ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden"
          type="button"
          onClick={() => setOpenMobile(false)}
        />
      ) : null}

      <aside
        onTouchStart={onMobileDrawerTouchStart}
        onTouchEnd={onMobileDrawerTouchEnd}
        className={cn(
          "fixed bottom-4 left-4 top-4 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-card/92 p-4 shadow-[var(--shadow-glass)] backdrop-blur-2xl transition-all duration-300 dark:bg-black/96 lg:z-40 lg:flex lg:translate-x-0",
          sidebarCollapsed ? "lg:w-24" : "lg:w-72",
          openMobile ? "translate-x-0" : "-translate-x-[110%]",
        )}
      >
        <div className="mb-5 shrink-0 flex items-center justify-between">
          <Link
            href={homeForRole(user.role)}
            className="flex items-center gap-3"
            onClick={(event) => {
              event.preventDefault();
              navigateTo(homeForRole(user.role));
            }}
          >
            <BrandLogo showText={false} markClassName="size-11" />
            <span className={cn(sidebarCollapsed && "lg:hidden")}>
              <span className="block font-semibold">EduPulse</span>
              <span className="text-xs text-muted-foreground">
                {user.orgName}
              </span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpenMobile(false)}
          >
            <X />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </Button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pb-2 pr-1">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const badgeCount = navBadgeCount(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  navigateTo(item.href);
                }}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground motion-safe hover:bg-muted hover:text-foreground dark:hover:bg-white/10",
                  sidebarCollapsed && "lg:justify-center lg:px-0",
                  active &&
                    "bg-primary/12 text-primary ring-1 ring-primary/15 dark:bg-white dark:text-black dark:ring-white/20",
                )}
                title={item.title}
              >
                <Icon className="size-4" />
                <span className={cn(sidebarCollapsed && "lg:hidden")}>
                  {item.title}
                </span>
                {badgeCount > 0 ? (
                  <span
                    className={cn(
                      "ml-auto grid size-5 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground",
                      sidebarCollapsed && "lg:absolute lg:-right-1 lg:-top-1",
                    )}
                  >
                    {Math.min(badgeCount, 9)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border pt-3 lg:hidden">
          <Link
            href={`/${user.role === "super_admin" ? "admin" : user.role}/settings`}
            onClick={(event) => {
              event.preventDefault();
              navigateTo(
                `/${user.role === "super_admin" ? "admin" : user.role}/settings`,
              );
            }}
            className={cn(
              "mb-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <ChevronRight className="size-4" />
            Settings
          </Link>
          <div
            className={cn(
              "grid gap-2",
              sidebarCollapsed
                ? "lg:grid-cols-1"
                : "grid-cols-2 lg:grid-cols-1",
            )}
          >
            <div
              className={cn(
                "rounded-2xl border border-border bg-background/50 p-1",
                sidebarCollapsed && "lg:grid lg:place-items-center",
              )}
            >
              <ThemeToggle />
            </div>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "justify-center rounded-2xl",
                sidebarCollapsed && "lg:px-0",
              )}
              onClick={() => logout()}
              title="Sign out"
            >
              <LogOut />
              <span className={cn(sidebarCollapsed && "lg:hidden")}>
                Sign out
              </span>
            </Button>
          </div>
        </div>
      </aside>

      <header
        className={cn(
          "fixed left-3 right-3 top-3 z-30 flex items-center justify-between transition duration-200 lg:hidden",
          openMobile && "pointer-events-none -translate-y-3 opacity-0",
        )}
      >
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Search"
          className="rounded-full border-border/70 bg-card/90 shadow-[var(--shadow-glass)] backdrop-blur-xl"
          onClick={() => {
            setSearchOpen((value) => !value);
            window.setTimeout(() => searchInputRef.current?.focus(), 30);
          }}
        >
          <Search />
        </Button>
        <div className="rounded-full border border-border/70 bg-card/90 p-1 shadow-[var(--shadow-glass)] backdrop-blur-xl">
          {notificationDropdown}
        </div>
      </header>

      {searchOpen ? (
        <div className="fixed left-3 right-3 top-16 z-40 rounded-[1.5rem] border border-border bg-popover p-2 text-popover-foreground shadow-2xl lg:hidden">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const first = searchResults[0];
              if (first) openSearchResult(first.href);
            }}
          >
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-background/70 px-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search pages"
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
              >
                <X />
              </Button>
            </div>
          </form>
          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto overscroll-contain">
            {searchResults.length === 0 ? (
              <div className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                No matching page found.
              </div>
            ) : (
              searchResults.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm hover:bg-muted"
                    onClick={() => openSearchResult(item.href)}
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.href}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {classAlertPromptVisible ? (
        <div className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md rounded-[1.5rem] border border-border bg-card/95 p-4 shadow-[var(--shadow-glass)] backdrop-blur-2xl lg:bottom-6 lg:right-6 lg:left-auto">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Turn on class alerts</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Get a short reminder before class starts and when it ends.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={enableDeviceNotifications}
                  disabled={pushStatus === "saving"}
                >
                  <Bell />
                  {pushStatus === "saving" ? "Saving..." : "Enable alerts"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.localStorage.setItem(
                      "edupulse.classAlerts.prompted",
                      "true",
                    );
                    setClassAlertPromptVisible(false);
                  }}
                >
                  Later
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <main
        className={cn(
          "min-h-screen px-3 pb-24 pt-20 sm:px-4 sm:pb-28 lg:pb-10 lg:pr-6 lg:pt-28",
          sidebarCollapsed ? "lg:pl-32" : "lg:pl-80",
        )}
      >
        <header
          className={cn(
            "fixed left-4 right-4 top-4 z-30 hidden lg:right-6 lg:block",
            sidebarCollapsed ? "lg:left-32" : "lg:left-80",
          )}
        >
          <div className="glass-panel flex h-16 items-center justify-between rounded-full px-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setOpenMobile(true)}
              >
                <Menu />
              </Button>
              <form
                className="relative hidden md:block"
                onSubmit={(event) => {
                  event.preventDefault();
                  const first = searchResults[0];
                  if (first) openSearchResult(first.href);
                }}
              >
                <div className="flex h-10 min-w-80 items-center gap-3 rounded-full border border-border bg-background/60 px-4 text-sm text-muted-foreground">
                  <Search className="size-4" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setSearchOpen(false);
                    }}
                    placeholder="Search pages and tools"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <Badge variant="secondary" className="font-mono">
                    <Command className="size-3" /> K
                  </Badge>
                </div>
                {searchOpen ? (
                  <div
                    className="absolute left-0 right-0 top-12 z-50 rounded-3xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    {searchResults.length === 0 ? (
                      <div className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                        No matching page found.
                      </div>
                    ) : (
                      searchResults.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.href}
                            type="button"
                            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm hover:bg-muted"
                            onClick={() => openSearchResult(item.href)}
                          >
                            <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
                              <Icon className="size-4" />
                            </span>
                            <span>
                              <span className="block font-semibold">
                                {item.title}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {item.href}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </form>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Notifications"
                    className="relative"
                  >
                    <Bell />
                    {unreadCount > 0 ? (
                      <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                        {Math.min(unreadCount, 9)}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    className="z-50 mt-2 w-88 rounded-3xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl"
                  >
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <p className="font-semibold">Notifications</p>
                        <p className="text-xs text-muted-foreground">
                          Class alerts and returned work
                        </p>
                      </div>
                      <Badge variant={unreadCount ? "warning" : "secondary"}>
                        {unreadCount} new
                      </Badge>
                    </div>
                    {notificationPermission === "default" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mx-3 mb-2 w-[calc(100%-1.5rem)]"
                        onClick={enableDeviceNotifications}
                      >
                        <Bell /> Enable device alerts
                      </Button>
                    ) : null}
                    <div className="max-h-80 space-y-2 overflow-y-auto p-1">
                      {notifications.length === 0 ? (
                        <div className="rounded-2xl bg-muted p-3 text-sm">
                          <p className="font-medium">No notifications yet</p>
                          <p className="text-xs text-muted-foreground">
                            Posts, grades, messages, and submission updates will
                            appear here.
                          </p>
                        </div>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full rounded-2xl border border-border bg-background/70 p-3 text-left text-sm transition hover:bg-muted"
                            onClick={() => {
                              if (item.actionUrl) {
                                navigateTo(item.actionUrl);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold">{item.title}</p>
                              <Badge variant="secondary">{item.kind}</Badge>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {item.body}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <ThemeToggle />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center gap-2 rounded-full p-1 pr-3 motion-safe hover:bg-muted">
                    <Avatar.Root className="grid size-10 place-items-center overflow-hidden rounded-full bg-primary/15 text-sm font-bold text-primary">
                      <Avatar.Image
                        className="size-full rounded-full object-cover"
                        src={user.photoURL ?? undefined}
                      />
                      <Avatar.Fallback>
                        {initials(user.displayName)}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <span className="hidden text-left sm:block">
                      <span className="block text-sm font-semibold leading-4">
                        {user.displayName}
                      </span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {user.role.replace("_", " ")}
                      </span>
                    </span>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    className="z-50 mt-2 w-80 rounded-3xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl"
                  >
                    <div className="p-3">
                      <p className="font-semibold">{user.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <div className="space-y-2 p-2">
                      <div className="rounded-2xl bg-muted p-3 text-sm">
                        <p className="font-medium">Workspace ready</p>
                        <p className="text-xs text-muted-foreground">
                          Your session stays on this device until you sign out.
                        </p>
                      </div>
                    </div>
                    <DropdownMenu.Separator className="my-2 h-px bg-border" />
                    <DropdownMenu.Item
                      className="flex cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-sm outline-none hover:bg-muted"
                      onClick={() => logout()}
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        </header>

        {routePending ? <RouteSkeleton /> : null}
        <div
          className={cn(
            "transition-opacity duration-150",
            routePending && "pointer-events-none opacity-0",
          )}
        >
          {children}
        </div>
      </main>

      <nav
        className={cn(
          "glass-panel fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[min(calc(100%-1rem),460px)] -translate-x-1/2 touch-none select-none items-center justify-between rounded-full px-2 py-2 transition duration-200 lg:hidden",
          openMobile && "pointer-events-none translate-y-24 opacity-0",
        )}
      >
        {mobilePriority.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const badgeCount = navBadgeCount(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.title}
              onClick={(event) => {
                event.preventDefault();
                navigateTo(item.href);
              }}
              className={cn(
                "relative grid size-12 place-items-center rounded-full text-muted-foreground motion-safe hover:bg-muted hover:text-foreground dark:hover:bg-white/10",
                active &&
                  "bg-primary text-primary-foreground dark:bg-white dark:text-black",
              )}
            >
              <Icon className="size-5" />
              {badgeCount > 0 ? (
                <span className="absolute right-0 top-0 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {Math.min(badgeCount, 9)}
                </span>
              ) : null}
            </Link>
          );
        })}
        <button
          type="button"
          aria-label="Open full menu"
          onClick={() => setOpenMobile(true)}
          className={cn(
            "grid size-12 place-items-center rounded-full text-muted-foreground motion-safe hover:bg-muted hover:text-foreground dark:hover:bg-white/10",
            openMobile &&
              "bg-primary text-primary-foreground dark:bg-white dark:text-black",
          )}
        >
          <Menu className="size-5" />
        </button>
      </nav>
    </div>
  );
}

function RouteSkeleton() {
  return (
    <div className="fixed inset-x-3 bottom-24 top-20 z-20 rounded-[1.5rem] border border-border/70 bg-background/94 p-4 shadow-2xl backdrop-blur-xl sm:inset-x-4 sm:bottom-28 lg:bottom-10 lg:left-80 lg:right-6 lg:top-28">
      <div className="h-full animate-pulse space-y-4 overflow-hidden">
        <div className="h-24 rounded-[1.5rem] bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-3xl bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            <div className="h-56 rounded-[1.5rem] bg-muted" />
            <div className="h-44 rounded-[1.5rem] bg-muted" />
          </div>
          <div className="hidden h-80 rounded-[1.5rem] bg-muted xl:block" />
        </div>
      </div>
    </div>
  );
}
