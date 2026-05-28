import { NotesPanel } from "@/components/dashboard/content-blocks";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  ClassBuilderPanel,
  ClassManagerPanel,
  ResourceLibraryManagerPanel,
  ResourceUploadPanel,
  TeacherMetricStrip,
} from "@/components/teacher/teacher-workflow-panels";
import { getTeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";

export default async function TeacherUploadsPage() {
  const workflowData = await getTeacherWorkflowData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content uploads"
        title="Create classes and publish classroom resources safely."
        description="Upload approved file types, attach resources to classes and subjects, save lesson notes, and keep files scoped to your institution."
      />
      <TeacherMetricStrip data={workflowData} />
      <div className="grid gap-6 xl:grid-cols-2">
        <ClassBuilderPanel />
        <ResourceUploadPanel data={workflowData} />
      </div>
      <ClassManagerPanel data={workflowData} />
      <ResourceLibraryManagerPanel data={workflowData} />
      <NotesPanel teacher items={workflowData.notes} />
    </div>
  );
}
