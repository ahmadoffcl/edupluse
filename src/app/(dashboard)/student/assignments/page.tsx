import { PageHeader } from "@/components/dashboard/page-header";
import { StudentAssignmentsPanel } from "@/components/student/student-assignments-panel";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentAssignmentsPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Assignments"
        title="Classwork that is easy to act on."
        description="Search every assignment, upload your work, review teacher files, and track feedback without digging through long lists."
      />
      <StudentAssignmentsPanel assignments={data.assignments} />
    </div>
  );
}
