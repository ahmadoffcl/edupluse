import {
  CompletionDonut,
  EngagementChart,
  PerformanceBandChart,
  StudentMomentumChart,
} from "@/components/dashboard/charts";
import { AnalyticsCockpit } from "@/components/dashboard/analytics-cockpit";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  StudentPerformancePanel,
  TeacherMetricStrip,
} from "@/components/teacher/teacher-workflow-panels";
import { getTeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";

export default async function TeacherAnalyticsPage() {
  const workflowData = await getTeacherWorkflowData();
  const atRisk = workflowData.performance.filter(
    (row) => row.band === "at_risk",
  ).length;
  const highMomentum = workflowData.performance.filter(
    (row) => row.band === "high_momentum",
  ).length;
  const missingWork = workflowData.performance.reduce(
    (total, row) => total + row.missingCount,
    0,
  );
  const gradingBacklog = workflowData.submissions.filter(
    (submission) => submission.status !== "graded",
  ).length;
  const bandChart = [
    {
      name: "At risk",
      value: workflowData.performance.filter((row) => row.band === "at_risk")
        .length,
    },
    {
      name: "Watch",
      value: workflowData.performance.filter((row) => row.band === "watch")
        .length,
    },
    {
      name: "Steady",
      value: workflowData.performance.filter((row) => row.band === "steady")
        .length,
    },
    {
      name: "Momentum",
      value: workflowData.performance.filter(
        (row) => row.band === "high_momentum",
      ).length,
    },
  ].filter((item) => item.value > 0);
  const momentumChart = workflowData.performance
    .slice()
    .sort((a, b) => a.performanceScore - b.performanceScore)
    .slice(0, 8)
    .map((row) => ({
      name: row.username ? `@${row.username}` : row.name,
      performance: row.performanceScore,
      submissions: row.submittedPercent,
      score: row.averageScore,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student insights"
        title="Detect weak students and compare momentum using real signals."
        description="Performance is weighted toward engagement, submissions, XP, recent activity, missing work, late work, and grade feedback."
      />
      <AnalyticsCockpit
        eyebrow="Teacher intelligence"
        title="A calm command center for student momentum."
        description="Spot risk, celebrate movement, and move straight from analytics into grading or class follow-up."
        cards={[
          {
            label: "At-risk students",
            value: atRisk,
            meta: "Lowest performance band",
            tone: "warning",
            icon: "risk",
          },
          {
            label: "High momentum",
            value: highMomentum,
            meta: "Strong recent activity",
            tone: "success",
            icon: "trend",
          },
          {
            label: "Missing work",
            value: missingWork,
            meta: "Across teacher classes",
            tone: "info",
            icon: "work",
          },
          {
            label: "Open grading",
            value: gradingBacklog,
            meta: "Submissions needing review",
            tone: "primary",
            icon: "activity",
          },
        ]}
      />
      <TeacherMetricStrip data={workflowData} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <EngagementChart data={workflowData.engagementChart} />
        <CompletionDonut data={workflowData.assignmentStatusChart} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <PerformanceBandChart data={bandChart} />
        <StudentMomentumChart data={momentumChart} />
      </div>
      <StudentPerformancePanel rows={workflowData.performance} />
    </div>
  );
}
