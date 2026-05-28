import { MessagesPanel } from "@/components/dashboard/content-blocks";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  CommunicationComposerPanel,
  CommunicationHistoryPanel,
} from "@/components/teacher/teacher-workflow-panels";
import { getTeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";

export default async function TeacherMessagesPage() {
  const workflowData = await getTeacherWorkflowData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Messaging"
        title="Publish announcements and schedule class communication."
        description="Send class announcements, create student notification records, and schedule exams or events from live class data."
      />
      <CommunicationComposerPanel data={workflowData} />
      <CommunicationHistoryPanel data={workflowData} />
      <MessagesPanel items={workflowData.messages} />
    </div>
  );
}
