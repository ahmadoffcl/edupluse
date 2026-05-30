import { CalendarClock, Clock3, Sparkles } from "lucide-react";
import {
  EmptyState,
  SchedulePanel,
} from "@/components/dashboard/content-blocks";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard/server-data";

function countByKind(
  tasks: Awaited<ReturnType<typeof getDashboardData>>["upcomingTasks"],
  kind: "assignment" | "exam" | "event" | "live",
) {
  return tasks.filter((task) => task.kind === kind).length;
}

export default async function StudentCalendarPage() {
  const data = await getDashboardData();
  const upcoming = data.upcomingTasks.slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title="Your class schedule and academic events."
        description="Live classes, quizzes, assignment deadlines, and events from your enrolled classes."
      />

      <div className="mb-5 grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        {[
          ["Assignments", countByKind(data.upcomingTasks, "assignment")],
          ["Quizzes", countByKind(data.upcomingTasks, "exam")],
          ["Live classes", countByKind(data.upcomingTasks, "live")],
          ["Events", countByKind(data.upcomingTasks, "event")],
        ].map(([label, value]) => (
          <Card key={String(label)} className="overflow-hidden">
            <CardContent className="p-2 text-center sm:flex sm:items-center sm:justify-between sm:gap-3 sm:p-4 sm:text-left">
              <div className="min-w-0">
                <p className="truncate text-[10px] text-muted-foreground sm:text-sm">
                  {label}
                </p>
                <p className="mt-1 text-base font-semibold leading-5 sm:text-2xl">
                  {value}
                </p>
              </div>
              <span className="mx-auto mt-1 grid size-8 place-items-center rounded-2xl bg-primary/10 text-primary sm:mx-0 sm:mt-0 sm:size-10">
                <CalendarClock className="size-4 sm:size-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <SchedulePanel items={data.schedule} />

        <Card className="xl:sticky xl:top-24 xl:self-start">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="font-semibold">Next important dates</h2>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState
                variant="schedule"
                message="No upcoming deadlines or events yet."
              />
            ) : (
              upcoming.map((task) => (
                <a
                  key={`${task.kind}-${task.id}`}
                  href={task.href}
                  className="block rounded-2xl border border-border bg-background/60 p-3 transition hover:-translate-y-1 hover:bg-muted"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {task.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {task.className}
                      </p>
                    </div>
                    <Badge variant={task.kind === "exam" ? "warning" : "info"}>
                      {task.kind}
                    </Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3" />
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(task.dueAt))}
                  </p>
                </a>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
