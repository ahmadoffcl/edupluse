"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CockpitCard = {
  label: string;
  value: string | number;
  meta: string;
  tone?: "primary" | "success" | "warning" | "info";
  icon?: "activity" | "users" | "risk" | "work" | "trend";
};

const toneClass: Record<NonNullable<CockpitCard["tone"]>, string> = {
  primary: "from-primary/24 to-primary/5 text-primary",
  success: "from-emerald-400/24 to-emerald-400/5 text-emerald-500",
  warning: "from-amber-400/24 to-amber-400/5 text-amber-500",
  info: "from-blue-400/24 to-blue-400/5 text-blue-500",
};

const iconMap = {
  activity: Activity,
  users: UsersRound,
  risk: AlertTriangle,
  work: ClipboardCheck,
  trend: TrendingUp,
} satisfies Record<NonNullable<CockpitCard["icon"]>, typeof Activity>;

export function AnalyticsCockpit({
  eyebrow,
  title,
  description,
  cards,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cards: CockpitCard[];
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-border bg-card/78 p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:p-5 lg:p-6",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(124,156,255,0.22),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(255,180,84,0.18),transparent_28%)]" />
      <div className="relative z-10 grid gap-5 xl:grid-cols-[0.82fr_1.18fr] xl:items-end">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-4"
        >
          <Badge className="w-fit">
            <Sparkles className="size-3.5" />
            {eyebrow}
          </Badge>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-3xl border border-border bg-background/60 p-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <BarChart3 className="size-5" />
            </span>
            <p className="text-sm text-muted-foreground">
              All numbers are calculated from live workspace records.
            </p>
          </div>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card, index) => {
            const Icon = iconMap[card.icon ?? "activity"];
            return (
              <motion.div
                key={card.label}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.04 }}
              >
                <Card className="overflow-hidden border-border/80 bg-background/60">
                  <CardContent className="relative p-4">
                    <div
                      className={cn(
                        "absolute inset-0 bg-gradient-to-br",
                        toneClass[card.tone ?? "primary"],
                      )}
                    />
                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {card.label}
                        </p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight">
                          {card.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {card.meta}
                        </p>
                      </div>
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-card/80">
                        <Icon className="size-5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
