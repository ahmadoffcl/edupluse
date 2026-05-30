import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/content-blocks";
import { StudentMissionsPanel } from "@/components/student/student-missions-panel";
import { getFeatureFlags } from "@/lib/server/feature-flags";

export default async function StudentMissionsPage() {
  const flags = await getFeatureFlags();

  if (!flags.smartLearningEnabled) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Daily Focus"
          title="Smart Learning is hidden for now."
          description="Your admin can turn Missions on from platform settings when your institute is ready."
        />
        <EmptyState
          variant="activity"
          message="Missions are currently hidden by your institute."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily Focus"
        title="Know exactly what to do next."
        description="Smart Learning Missions turn your real classwork into a simple checklist: finish urgent work, review feedback, open new teacher files, and keep momentum."
      />
      <StudentMissionsPanel />
    </div>
  );
}
