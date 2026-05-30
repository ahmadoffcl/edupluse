import { ArrowUpRight, CircleAlert, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Metric } from "@/lib/types";
import { cn } from "@/lib/utils";

const toneClass: Record<Metric["tone"], string> = {
  primary: "text-primary bg-primary/12",
  success: "text-emerald-500 bg-emerald-500/12",
  warning: "text-amber-500 bg-amber-500/12",
  info: "text-blue-500 bg-blue-500/12",
};

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <CardContent className="p-2.5 text-center sm:p-4 sm:text-left">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-[11px] text-muted-foreground sm:text-sm">
                  {metric.label}
                </p>
                <p className="mt-1 truncate text-lg font-semibold tracking-tight sm:text-2xl">
                  {metric.value}
                </p>
              </div>
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-2xl sm:size-9",
                  toneClass[metric.tone],
                )}
              >
                {metric.tone === "warning" ? (
                  <CircleAlert className="size-4" />
                ) : (
                  <Sparkles className="size-4" />
                )}
              </span>
            </div>
            <div className="mt-2 flex min-w-0 items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground sm:mt-4 sm:justify-start sm:text-xs">
              <ArrowUpRight className="size-3 shrink-0 text-emerald-500 sm:size-4" />
              <span className="truncate">{metric.delta}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
