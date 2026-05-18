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
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { roleNav } from "@/lib/mock-data";
import { canAccessPath, homeForRole } from "@/lib/permissions";
import { cn, initials } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [openMobile, setOpenMobile] = useState(false);

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
          "fixed bottom-4 left-4 top-4 z-40 w-72 rounded-[2rem] border border-border/70 bg-card/80 p-4 shadow-[var(--shadow-glass)] backdrop-blur-2xl transition-transform lg:translate-x-0",
          openMobile ? "translate-x-0" : "-translate-x-[110%] lg:translate-x-0",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={homeForRole(user.role)}
            className="flex items-center gap-3"
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

        <nav className="space-y-1">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
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

        <div className="absolute inset-x-4 bottom-4 rounded-3xl border border-border bg-background/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm font-semibold">AI-ready workspace</p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Study assistant, summaries, and quiz drafts are scoped to your
            active organization.
          </p>
        </div>
      </aside>

      <main className="min-h-screen px-4 pb-10 pt-24 lg:pl-80 lg:pr-6">
        <header className="fixed left-4 right-4 top-4 z-30 lg:left-80 lg:right-6">
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
              <div className="hidden h-10 min-w-72 items-center gap-3 rounded-full border border-border bg-background/60 px-4 text-sm text-muted-foreground md:flex">
                <Search className="size-4" />
                Search classes, notes, students
                <Badge variant="secondary" className="ml-auto font-mono">
                  <Command className="size-3" /> K
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell />
              </Button>
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
                        <p className="font-medium">No notifications yet</p>
                        <p className="text-xs text-muted-foreground">
                          Class alerts, messages, and achievement updates will
                          appear here when your workspace has activity.
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

        {children}
      </main>
    </div>
  );
}
