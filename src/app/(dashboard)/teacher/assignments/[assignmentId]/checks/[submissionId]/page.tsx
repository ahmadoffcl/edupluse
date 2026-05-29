import { PageHeader } from "@/components/dashboard/page-header";
import { IntegrityReportPanel } from "@/components/teacher/integrity-report-panel";

export default async function TeacherAssignmentChecksPage({
  params,
}: {
  params: Promise<{ assignmentId: string; submissionId: string }>;
}) {
  const { assignmentId, submissionId } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Checks report"
        title="Assignment integrity review."
        description="Review AI-use risk, similarity evidence, matched highlights, and neutral teacher guidance."
      />
      <IntegrityReportPanel
        assignmentId={assignmentId}
        submissionId={submissionId}
      />
    </div>
  );
}
