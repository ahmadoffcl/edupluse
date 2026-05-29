import { AiPanel } from "@/components/ai/ai-panel";
import {
  ActivityPanel,
  GamificationPanel,
} from "@/components/dashboard/content-blocks";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { PageHeader } from "@/components/dashboard/page-header";
import { StudentClassesPanel } from "@/components/student/student-classes-panel";
import { StudentMissionsPanel } from "@/components/student/student-missions-panel";
import { StudentPerformancePanel } from "@/components/student/student-performance-panel";
import { UpcomingTasksPanel } from "@/components/student/upcoming-tasks-panel";
import { getDashboardData } from "@/lib/dashboard/server-data";
import { getStudentPerformanceData } from "@/lib/dashboard/student-performance";

export default async function StudentDashboardPage() {
  const [data, performanceData] = await Promise.all([
    getDashboardData(),
    getStudentPerformanceData(),
  ]);
  const visibleMetrics = data.metrics
    .filter((metric) => metric.label !== "Attendance")
    .slice(0, 3);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Student dashboard"
        title="Your classroom, today."
        description="A clean view of your classes, upcoming work, feedback, and learning progress."
      />
      <MetricGrid metrics={visibleMetrics} />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:gap-5">
        <main className="space-y-4 sm:space-y-5">
          <StudentClassesPanel classes={data.classes} compact />
          <UpcomingTasksPanel tasks={data.upcomingTasks} compact />
          <StudentMissionsPanel compact />
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
