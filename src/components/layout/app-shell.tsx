"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bell,
  ChevronDown,
  Command,
  LogOut,
  Menu,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { roleNav } from "@/lib/mock-data";
import { canAccessPath, homeForRole } from "@/lib/permissions";
import { cn, initials } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
  actionUrl?: string | null;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [openMobile, setOpenMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [routePending, setRoutePending] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const notificationsLoadedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRoutePending(false), 80);
    return () => window.clearTimeout(timer);
  }, [pathname]);

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

  const nav = useMemo(() => roleNav[user?.role ?? "student"], [user?.role]);
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
              if (
                !notificationsLoadedRef.current ||
                item.readAt ||
                notifiedIds.has(item.id)
              ) {
                notifiedIds.add(item.id);
                continue;
              }

              const browserNotification = new window.Notification(item.title, {
                body: item.body,
                tag: item.id,
              });
              browserNotification.onclick = () => {
                window.focus();
                if (item.actionUrl) router.push(item.actionUrl);
              };
              notifiedIds.add(item.id);
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

  async function enableDeviceNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
  }

  function openSearchResult(href: string) {
    setSearchOpen(false);
    setSearchQuery("");
    navigateTo(href);
  }

  function navigateTo(href: string) {
    if (href !== pathname) {
      setRoutePending(true);
      router.push(href);
    }
    setOpenMobile(false);
  }

  const unreadCount = notifications.filter((item) => !item.readAt).length;

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

  return (
    <div className="min-h-screen">
      <div className="premium-grid pointer-events-none fixed inset-x-0 top-0 h-[360px]" />
      <aside
        className={cn(
          "fixed bottom-4 left-4 top-4 z-40 hidden w-72 rounded-[2rem] border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-glass)] backdrop-blur-2xl transition-transform lg:block lg:translate-x-0",
          openMobile ? "translate-x-0" : "-translate-x-[110%]",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={homeForRole(user.role)}
            className="flex items-center gap-3"
            onClick={(event) => {
              event.preventDefault();
              navigateTo(homeForRole(user.role));
            }}
          >
            <BrandLogo showText={false} markClassName="size-11" />
            <span>
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
            <Menu />
          </Button>
        </div>

        <nav className="max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto pr-1">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  navigateTo(item.href);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground motion-safe hover:bg-muted hover:text-foreground",
                  active &&
                    "bg-primary/12 text-primary ring-1 ring-primary/15 dark:bg-primary/15",
                )}
              >
                <Icon className="size-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-h-screen px-3 pb-24 pt-4 sm:px-4 sm:pb-28 sm:pt-6 lg:pb-10 lg:pl-80 lg:pr-6 lg:pt-24">
        <header className="fixed left-4 right-4 top-4 z-30 hidden lg:left-80 lg:right-6 lg:block">
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
                    <Avatar.Root className="grid size-10 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      <Avatar.Image src={user.photoURL ?? undefined} />
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

      <nav className="glass-panel fixed bottom-4 left-1/2 z-50 flex w-[min(calc(100%-2rem),440px)] -translate-x-1/2 items-center justify-between rounded-full px-2 py-2 lg:hidden">
        {nav.slice(0, 5).map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
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
                "grid size-12 place-items-center rounded-full text-muted-foreground motion-safe hover:bg-muted hover:text-foreground",
                active && "bg-primary text-primary-foreground",
              )}
            >
              <Icon className="size-5" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function RouteSkeleton() {
  return (
    <div className="fixed inset-x-3 bottom-24 top-4 z-20 rounded-[1.5rem] border border-border/70 bg-background/94 p-4 shadow-2xl backdrop-blur-xl sm:inset-x-4 sm:bottom-28 sm:top-6 lg:bottom-10 lg:left-80 lg:right-6 lg:top-24">
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
