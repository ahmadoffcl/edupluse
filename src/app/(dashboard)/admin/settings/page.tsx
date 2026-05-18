import { FeaturePage } from "@/components/dashboard/feature-page";

export default function AdminSettingsPage() {
  return (
    <FeaturePage
      eyebrow="Platform configuration"
      title="Configure institute policies, roles, AI, storage, and notifications."
      description="Enterprise settings for multi-tenant operation, feature flags, security, and communication defaults."
      action="Save configuration"
      items={[
        {
          title: "Role permissions",
          meta: "Student, teacher, admin",
          stat: "Active",
          tone: "success",
        },
        {
          title: "Storage buckets",
          meta: "Avatars, resources, submissions",
          stat: "Guarded",
          tone: "info",
        },
        {
          title: "AI controls",
          meta: "Rate limits and audit logs",
          stat: "Guarded",
          tone: "success",
        },
      ]}
    />
  );
}
