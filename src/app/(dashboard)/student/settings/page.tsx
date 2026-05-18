import { FeaturePage } from "@/components/dashboard/feature-page";

export default function StudentSettingsPage() {
  return (
    <FeaturePage
      eyebrow="Profile settings"
      title="Personalization, security, notifications, and devices."
      description="Profile details, theme preference, notification controls, privacy, and multi-device session visibility."
      action="Save changes"
      items={[
        {
          title: "Profile",
          meta: "Name, avatar, contact",
          stat: "Ready",
          tone: "success",
        },
        {
          title: "Notifications",
          meta: "Due dates, attendance, achievements",
          stat: "12 rules",
          tone: "info",
        },
        {
          title: "Sessions",
          meta: "Current device and recent logins",
          stat: "3 devices",
          tone: "warning",
        },
      ]}
    />
  );
}
