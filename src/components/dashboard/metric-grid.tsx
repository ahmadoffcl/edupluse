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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="overflow-hidden">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {metric.label}
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                  {metric.value}
                </p>
              </div>
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-2xl sm:size-9",
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
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground sm:mt-4">
              <ArrowUpRight className="size-4 text-emerald-500" />
              {metric.delta}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
