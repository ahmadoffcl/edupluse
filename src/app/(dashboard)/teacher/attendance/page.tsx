import { AttendanceChart } from "@/components/dashboard/charts";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function TeacherAttendancePage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Attendance manager"
        title="Mark attendance and spot risky patterns."
        description="Class attendance, monthly analytics, absence ratio, and alert generation."
        action="Mark attendance"
        items={[
          {
            title: "Grade 10-A",
            meta: "32 students",
            stat: "96%",
            tone: "success",
          },
          {
            title: "Batch Alpha",
            meta: "26 students",
            stat: "89%",
            tone: "warning",
          },
          {
            title: "Online weekend",
            meta: "44 students",
            stat: "92%",
            tone: "info",
          },
        ]}
      />
      <AttendanceChart data={data.attendanceChart} />
    </div>
  );
}
