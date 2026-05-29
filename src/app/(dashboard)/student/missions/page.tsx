import { PageHeader } from "@/components/dashboard/page-header";
import { StudentMissionsPanel } from "@/components/student/student-missions-panel";
import { getStudentDailyFocus } from "@/lib/dashboard/learning-missions";

export default async function StudentMissionsPage() {
  const focus = await getStudentDailyFocus();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Smart missions"
        title="Your next best learning moves."
        description="EduPulse turns real assignments, materials, feedback, and deadlines into a clear daily path."
      />
      <StudentMissionsPanel data={focus} />
    </div>
  );
}
