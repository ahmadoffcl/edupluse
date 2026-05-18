"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Bell, Search } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { publicNav } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function PublicNavbar() {
  const pathname = usePathname();

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
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search />
          </Button>
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
