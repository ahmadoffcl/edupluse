import {
  EngagementChart,
  CompletionDonut,
} from "@/components/dashboard/charts";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function TeacherAnalyticsPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Student insights"
        title="Detect weak students and compare class performance."
        description="Engagement analytics, performance comparison, attendance monitoring, and intervention signals."
        action="Export insights"
        items={[
          {
            title: "At-risk students",
            meta: "Low engagement + missed work",
            stat: "11",
            tone: "warning",
          },
          {
            title: "High momentum",
            meta: "Improving weekly",
            stat: "28",
            tone: "success",
          },
          {
            title: "Feedback speed",
            meta: "Median return time",
            stat: "18h",
            tone: "info",
          },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <EngagementChart data={data.engagementChart} />
        <CompletionDonut data={data.assignmentStatusChart} />
      </div>
    </div>
  );
}
