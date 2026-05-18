import { AssignmentsPanel } from "@/components/dashboard/content-blocks";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function TeacherAssignmentsPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Assignment manager"
        title="Create, schedule, grade, and return work."
        description="Rich instructions, due dates, file submissions, rubric grading, feedback, and completion tracking."
        action="Create assignment"
        items={[
          {
            title: "Needs grading",
            meta: "Physics and English",
            stat: "28",
            tone: "warning",
          },
          {
            title: "Published",
            meta: "Active assignments",
            stat: "12",
            tone: "info",
          },
          {
            title: "Returned",
            meta: "This week",
            stat: "156",
            tone: "success",
          },
        ]}
      />
      <AssignmentsPanel teacher items={data.assignments} />
    </div>
  );
}
