import {
  CompletionDonut,
  EngagementChart,
} from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  StudentPerformancePanel,
  TeacherMetricStrip,
} from "@/components/teacher/teacher-workflow-panels";
import { getTeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";

export default async function TeacherAnalyticsPage() {
  const workflowData = await getTeacherWorkflowData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student insights"
        title="Detect weak students and compare momentum using real signals."
        description="Performance is weighted toward engagement, submissions, XP, recent activity, missing work, late work, and grade feedback."
      />
      <TeacherMetricStrip data={workflowData} />
      <StudentPerformancePanel rows={workflowData.performance} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <EngagementChart data={workflowData.engagementChart} />
        <CompletionDonut data={workflowData.assignmentStatusChart} />
      </div>
    </div>
  );
}
