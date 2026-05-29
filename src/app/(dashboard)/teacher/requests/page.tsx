import { PageHeader } from "@/components/dashboard/page-header";
import { TeacherRequestsPanel } from "@/components/teacher/teacher-requests-panel";
import { getTeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";

export default async function TeacherRequestsPage() {
  const data = await getTeacherWorkflowData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student access"
        title="Review every class join request in one place."
        description="Approve students only when they belong in the classroom. Accepted students appear in the class roster immediately."
      />
      <TeacherRequestsPanel requests={data.joinRequests} />
    </div>
  );
}
