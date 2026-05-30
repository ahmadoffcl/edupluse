import { AiPanel } from "@/components/ai/ai-panel";
import {
  ActivityPanel,
  GamificationPanel,
} from "@/components/dashboard/content-blocks";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { StudentClassesPanel } from "@/components/student/student-classes-panel";
import { StudentMissionsPanel } from "@/components/student/student-missions-panel";
import { StudentPerformancePanel } from "@/components/student/student-performance-panel";
import { UpcomingTasksPanel } from "@/components/student/upcoming-tasks-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard/server-data";
import { getStudentPerformanceData } from "@/lib/dashboard/student-performance";
import { getFeatureFlags } from "@/lib/server/feature-flags";
import {
  BookOpen,
  CalendarClock,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export default async function StudentDashboardPage() {
  const [data, performanceData, flags] = await Promise.all([
    getDashboardData(),
    getStudentPerformanceData(),
    getFeatureFlags(),
  ]);
  const visibleMetrics = data.metrics
    .filter(
      (metric) =>
        metric.label !== "Attendance" && metric.label !== "Active records",
    )
    .slice(0, 3);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-border bg-card/88 p-4 shadow-[var(--shadow-glass)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <Badge variant="info">Student workspace</Badge>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Your classroom, today.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Classes, deadlines, feedback, and notes are organized into one
              calm learning home.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["Classes", data.classes.length, BookOpen],
                ["Tasks", data.upcomingTasks.length, CalendarClock],
                ["XP", data.totalXp, Sparkles],
              ] satisfies Array<[string, number, LucideIcon]>
            ).map(([label, value, Icon]) => (
              <Card key={String(label)} className="bg-background/65">
                <CardContent className="p-2 text-center sm:p-3">
                  <Icon className="mx-auto mb-1 size-4 text-primary" />
                  <p className="truncate text-base font-semibold leading-5 sm:text-xl">
                    {String(value)}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
                    {String(label)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <MetricGrid metrics={visibleMetrics} />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:gap-5">
        <main className="space-y-4 sm:space-y-5">
          <StudentClassesPanel classes={data.classes} compact />
          <UpcomingTasksPanel tasks={data.upcomingTasks} compact />
          {flags.smartLearningEnabled ? <StudentMissionsPanel compact /> : null}
          <StudentPerformancePanel data={performanceData} />
        </main>
        <aside className="space-y-4 sm:space-y-5 xl:sticky xl:top-24 xl:self-start">
          <GamificationPanel
            totalXp={data.totalXp}
            streak={data.currentStreak}
          />
          <ActivityPanel items={data.activities} />
          <AiPanel />
        </aside>
      </div>
    </div>
  );
}
