import { Button } from "@/components/ui/button";
import { AiPanel } from "@/components/ai/ai-panel";
import {
  ActivityPanel,
  AssignmentsPanel,
  GamificationPanel,
  LeaderboardPanel,
  NotesPanel,
  QuickActionsPanel,
  SchedulePanel,
} from "@/components/dashboard/content-blocks";
import {
  AttendanceChart,
  EngagementChart,
} from "@/components/dashboard/charts";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { PageHeader } from "@/components/dashboard/page-header";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentDashboardPage() {
  const data = await getDashboardData();

  return (
    <div>
      <PageHeader
        eyebrow="Student dashboard"
        title="Your daily learning command center."
        description="Schedule, assignments, notes, attendance, gamification, messages, and AI support in one motivating workspace."
        action={<Button variant="premium">Ask AI study assistant</Button>}
      />
      <MetricGrid metrics={data.metrics} />
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <QuickActionsPanel role="student" />
          <SchedulePanel items={data.schedule} />
          <AssignmentsPanel items={data.assignments} />
          <div className="grid gap-6 xl:grid-cols-2">
            <EngagementChart data={data.engagementChart} />
            <AttendanceChart data={data.attendanceChart} />
          </div>
          <NotesPanel items={data.notes} />
        </div>
        <div className="space-y-6">
          <AiPanel />
          <GamificationPanel
            totalXp={data.totalXp}
            streak={data.leaderboard[0]?.streak ?? 0}
          />
          <LeaderboardPanel items={data.leaderboard} />
          <ActivityPanel items={data.activities} />
        </div>
      </div>
    </div>
  );
}
