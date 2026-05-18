import {
  AttendanceChart,
  CompletionDonut,
  EngagementChart,
} from "@/components/dashboard/charts";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function AdminAnalyticsPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Analytics"
        title="Student engagement, attendance, completion, and teacher activity."
        description="Advanced dashboards for system health, academic momentum, and operations."
        action="Create report"
        items={[
          {
            title: "Active users",
            meta: "Daily active learners",
            stat: "+14%",
            tone: "success",
          },
          {
            title: "Completion rate",
            meta: "Assignments done on time",
            stat: "86%",
            tone: "info",
          },
          {
            title: "Teacher activity",
            meta: "Uploads and grading",
            stat: "92%",
            tone: "success",
          },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <EngagementChart data={data.engagementChart} />
        <CompletionDonut data={data.assignmentStatusChart} />
      </div>
      <AttendanceChart data={data.attendanceChart} />
    </div>
  );
}
