import { SchedulePanel } from "@/components/dashboard/content-blocks";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentCalendarPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Calendar"
        title="Classes, exams, events, holidays, and personal study blocks."
        description="A single calendar surface for academic operations and daily productivity."
        action="Add event"
        items={[
          {
            title: "Mathematics exam",
            meta: "May 21 • 10:00",
            stat: "Exam",
            tone: "warning",
          },
          {
            title: "Science fair",
            meta: "May 24 • Auditorium",
            stat: "Event",
            tone: "info",
          },
          {
            title: "Eid holiday",
            meta: "June 17",
            stat: "Holiday",
            tone: "success",
          },
        ]}
      />
      <SchedulePanel items={data.schedule} />
    </div>
  );
}
