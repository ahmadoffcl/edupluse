import {
  BestNextFeaturesPanel,
  SecurityCommandPanel,
} from "@/components/dashboard/content-blocks";
import { FeaturePage } from "@/components/dashboard/feature-page";

export default function AdminSecurityPage() {
  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Security"
        title="Prevent bypass across routes, APIs, records, and file access."
        description="The MVP uses signed HTTP-only app sessions, server route gates, verified identity checks, tenant-scoped access, and AI audit logs."
        action="Run audit"
        items={[
          {
            title: "Route protection",
            meta: "Next.js proxy checks signed app sessions before dashboards load",
            stat: "Server",
            tone: "success",
          },
          {
            title: "Data protection",
            meta: "Organization and role membership isolate every record",
            stat: "Tenant-safe",
            tone: "success",
          },
          {
            title: "Token protection",
            meta: "Only verified accounts can receive dashboard sessions",
            stat: "Required",
            tone: "warning",
          },
        ]}
      />
      <SecurityCommandPanel />
      <BestNextFeaturesPanel />
    </div>
  );
}
