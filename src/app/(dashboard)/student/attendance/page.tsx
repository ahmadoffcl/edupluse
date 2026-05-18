import { AttendanceChart } from "@/components/dashboard/charts";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentAttendancePage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Attendance"
        title="Attendance history with smart visuals."
        description="Monthly analytics, absent/present ratio, course-level history, and alerts."
        action="Export"
        items={[
          {
            title: "Overall",
            meta: "Current term",
            stat: "94%",
            tone: "success",
          },
          {
            title: "Physics",
            meta: "Grade 10-A",
            stat: "96%",
            tone: "success",
          },
          {
            title: "Chemistry",
            meta: "Weekend batch",
            stat: "88%",
            tone: "warning",
          },
        ]}
      />
      <AttendanceChart data={data.attendanceChart} />
    </div>
  );
}
