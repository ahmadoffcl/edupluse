import { FeatureFlagsPanel } from "@/components/admin/feature-flags-panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { getFeatureFlags } from "@/lib/server/feature-flags";

export default async function AdminSettingsPage() {
  const flags = await getFeatureFlags();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Platform configuration"
        title="Control institute features and defaults."
        description="Keep experimental or advanced areas hidden until your institute is ready to use them."
      />
      <FeatureFlagsPanel smartLearningEnabled={flags.smartLearningEnabled} />
    </div>
  );
}
