import { PageHeader } from "@/components/dashboard/page-header";
import {
  AssignmentManagerPanel,
  AssignmentCreatorPanel,
  GradingQueuePanel,
  TeacherMetricStrip,
} from "@/components/teacher/teacher-workflow-panels";
import { getTeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";

export default async function TeacherAssignmentsPage() {
  const workflowData = await getTeacherWorkflowData();

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        eyebrow="Assignment manager"
        title="Create, publish, and grade classwork."
        description="Manage due dates, submissions, feedback, and grading queues from live classroom records."
      />
      <TeacherMetricStrip data={workflowData} />
      <AssignmentCreatorPanel data={workflowData} />
      <AssignmentManagerPanel data={workflowData} />
      <GradingQueuePanel data={workflowData} />
    </div>
  );
}
