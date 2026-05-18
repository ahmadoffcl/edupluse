import { Button } from "@/components/ui/button";
import {
  ActivityPanel,
  AssignmentsPanel,
  BestNextFeaturesPanel,
  MessagesPanel,
  OnboardingPanel,
  QuickActionsPanel,
  SecurityCommandPanel,
} from "@/components/dashboard/content-blocks";
import {
  AttendanceChart,
  CompletionDonut,
  EngagementChart,
} from "@/components/dashboard/charts";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { PageHeader } from "@/components/dashboard/page-header";
import { getDashboardData } from "@/lib/dashboard/server-data";
import { getAdminUsers } from "@/lib/dashboard/admin-users";

export default async function AdminDashboardPage() {
  const [data, users] = await Promise.all([
    getDashboardData(),
    getAdminUsers(),
  ]);
  const studentCount = users.filter((user) => user.role === "student").length;
  const teacherCount = users.filter((user) => user.role === "teacher").length;
  const adminCount = users.filter(
    (user) => user.role === "admin" || user.role === "super_admin",
  ).length;

  return (
    <div>
      <PageHeader
        eyebrow="Admin command center"
        title="Enterprise-grade control over every institute workflow."
        description="Manage teachers, students, classes, permissions, content moderation, analytics, announcements, reports, and platform configuration."
        action={<Button variant="premium">Create institute invite</Button>}
      />
      <MetricGrid metrics={data.metrics} />
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <QuickActionsPanel role="admin" />
          <div className="grid gap-6 xl:grid-cols-2">
            <EngagementChart data={data.engagementChart} />
            <AttendanceChart data={data.attendanceChart} />
          </div>
          <FeaturePage
            eyebrow="Operations"
            title="System-wide overview"
            description="A condensed control surface for admins and platform owners."
            action="Configure"
            items={[
              {
                title: "Teachers",
                meta: "Registered educator accounts",
                stat: `${teacherCount}`,
                tone: "info",
              },
              {
                title: "Students",
                meta: "Registered learner accounts",
                stat: `${studentCount}`,
                tone: "success",
              },
              {
                title: "Admins",
                meta: "Privileged operators",
                stat: `${adminCount}`,
                tone: "warning",
              },
            ]}
          />
          <BestNextFeaturesPanel />
          <AssignmentsPanel teacher items={data.assignments} />
        </div>
        <div className="space-y-6">
          <SecurityCommandPanel />
          <OnboardingPanel />
          <CompletionDonut data={data.assignmentStatusChart} />
          <ActivityPanel items={data.activities} />
          <MessagesPanel items={data.messages} />
        </div>
      </div>
    </div>
  );
}
