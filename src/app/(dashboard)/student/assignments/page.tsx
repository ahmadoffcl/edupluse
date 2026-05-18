import { AssignmentsPanel } from "@/components/dashboard/content-blocks";
import { PageHeader } from "@/components/dashboard/page-header";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentAssignmentsPage() {
  const data = await getDashboardData();

  return (
    <div>
      <PageHeader
        eyebrow="Assignments"
        title="Submit work, track feedback, and protect your streak."
        description="Deadlines, file uploads, submission history, teacher comments, marks, and grading states are organized here."
      />
      <AssignmentsPanel items={data.assignments} />
    </div>
  );
}
