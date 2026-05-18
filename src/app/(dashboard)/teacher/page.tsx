import { Button } from "@/components/ui/button";
import { AiPanel } from "@/components/ai/ai-panel";
import {
  ActivityPanel,
  AssignmentsPanel,
  MessagesPanel,
  NotesPanel,
  QuickActionsPanel,
  RiskRadarPanel,
  SchedulePanel,
} from "@/components/dashboard/content-blocks";
import {
  CompletionDonut,
  EngagementChart,
} from "@/components/dashboard/charts";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { PageHeader } from "@/components/dashboard/page-header";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function TeacherDashboardPage() {
  const data = await getDashboardData();

  return (
    <div>
      <PageHeader
        eyebrow="Teacher dashboard"
        title="Run classes, support students, and move grading faster."
        description="Manage assignments, attendance, uploads, announcements, grading, student insights, and AI-assisted lesson work."
        action={<Button variant="premium">Generate quiz draft</Button>}
      />
      <MetricGrid metrics={data.metrics} />
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <QuickActionsPanel role="teacher" />
          <SchedulePanel items={data.schedule} />
          <AssignmentsPanel teacher items={data.assignments} />
          <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <EngagementChart data={data.engagementChart} />
            <CompletionDonut data={data.assignmentStatusChart} />
          </div>
          <NotesPanel teacher items={data.notes} />
        </div>
        <div className="space-y-6">
          <AiPanel mode="quiz" />
          <RiskRadarPanel items={data.riskSignals} />
          <ActivityPanel items={data.activities} />
          <MessagesPanel items={data.messages} />
        </div>
      </div>
    </div>
  );
}
