import { AnalyticsCockpit } from "@/components/dashboard/analytics-cockpit";
import {
  CompletionDonut,
  EngagementChart,
  MetricBarChart,
} from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";
import { StudentPerformancePanel } from "@/components/student/student-performance-panel";
import { getDashboardData } from "@/lib/dashboard/server-data";
import { getStudentPerformanceData } from "@/lib/dashboard/student-performance";

export default async function StudentAnalyticsPage() {
  const [data, performanceData] = await Promise.all([
    getDashboardData(),
    getStudentPerformanceData(),
  ]);
  const progressBars = [
    { name: "Performance", value: performanceData.performanceScore },
    { name: "Submitted", value: performanceData.submittedPercent },
    { name: "Score", value: performanceData.averageScore },
    { name: "XP signals", value: Math.min(100, performanceData.xp / 10) },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Learning analytics"
        title="Understand your progress without clutter."
        description="Track real assignment completion, score movement, engagement, XP, and feedback from your classes."
      />
      <AnalyticsCockpit
        eyebrow="Personal progress"
        title="Your learning signal, simplified."
        description="EduPulse combines real submissions, XP, feedback, and upcoming work into one focused analytics view."
        cards={[
          {
            label: "Performance",
            value: `${performanceData.performanceScore}%`,
            meta: performanceData.band.replace("_", " "),
            tone: "primary",
            icon: "trend",
          },
          {
            label: "Submitted",
            value: `${performanceData.submittedPercent}%`,
            meta: `${performanceData.missingCount} missing`,
            tone: "success",
            icon: "work",
          },
          {
            label: "Average score",
            value: `${performanceData.averageScore}%`,
            meta: `${performanceData.lateCount} late`,
            tone: "info",
            icon: "activity",
          },
          {
            label: "XP",
            value: performanceData.xp,
            meta: "Learning activity",
            tone: "warning",
            icon: "risk",
          },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <EngagementChart data={data.engagementChart} />
        <CompletionDonut data={data.assignmentStatusChart} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <MetricBarChart data={progressBars} />
        <StudentPerformancePanel data={performanceData} />
      </div>
    </div>
  );
}
