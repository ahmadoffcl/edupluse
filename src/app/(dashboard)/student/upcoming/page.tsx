import { PageHeader } from "@/components/dashboard/page-header";
import { UpcomingTasksPanel } from "@/components/student/upcoming-tasks-panel";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentUpcomingTasksPage() {
  const data = await getDashboardData();

  return (
    <div>
      <PageHeader
        eyebrow="Task center"
        title="Everything coming up next."
        description="Real assignment deadlines, quiz alerts, live classes, and major class events from your enrolled classrooms."
      />
      <UpcomingTasksPanel tasks={data.upcomingTasks} />
    </div>
  );
}
