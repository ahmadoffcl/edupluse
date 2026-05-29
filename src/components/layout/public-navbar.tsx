"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Bell, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { publicNav } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function PublicNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchItems = useMemo(
    () => [
      { title: "Home", href: "/", hint: "Main EduPulse overview" },
      ...publicNav.map((item) => ({
        ...item,
        hint:
          item.href === "/features"
            ? "Platform modules and workflows"
            : item.href === "/about"
              ? "EduPulse mission and model"
              : "Support and contact",
      })),
      { title: "Login", href: "/login", hint: "Open your workspace" },
      { title: "Signup", href: "/signup", hint: "Create a learner account" },
    ],
    [],
  );
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return searchItems;
    return searchItems.filter((item) =>
      `${item.title} ${item.href} ${item.hint}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, searchItems]);

  function go(href: string) {
    setSearchOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <nav className="glass-panel mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full px-3 pl-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BrandLogo markClassName="size-9 rounded-full" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm text-muted-foreground motion-safe hover:bg-muted hover:text-foreground",
                pathname === item.href && "bg-muted text-foreground",
              )}
            >
              {item.title}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              onClick={() => setSearchOpen((value) => !value)}
            >
              <Search />
            </Button>
            {searchOpen ? (
              <form
                className="fixed left-4 right-4 top-24 rounded-3xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(86vw,360px)]"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (results[0]) go(results[0].href);
                }}
              >
                <div className="flex h-11 items-center gap-2 rounded-full border border-border bg-background/70 px-4">
                  <Search className="size-4 text-muted-foreground" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search EduPulse"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
                <div className="mt-2 grid gap-1">
                  {results.length === 0 ? (
                    <div className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
                      No result found.
                    </div>
                  ) : (
                    results.slice(0, 6).map((item) => (
                      <button
                        key={item.href}
                        type="button"
                        className="rounded-2xl px-3 py-2 text-left hover:bg-muted"
                        onClick={() => go(item.href)}
                      >
                        <span className="block text-sm font-semibold">
                          {item.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {item.hint}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </form>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell />
          </Button>
          <ThemeToggle />
          <Button asChild variant="premium" className="hidden sm:inline-flex">
            <Link href="/login">
              Open platform <ArrowRight />
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
