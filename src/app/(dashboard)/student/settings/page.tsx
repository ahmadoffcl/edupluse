import { PageHeader } from "@/components/dashboard/page-header";
import { ProfileSettingsPanel } from "@/components/profile/profile-settings-panel";
import { getProfileSettings } from "@/lib/dashboard/profile-settings";

export default async function StudentSettingsPage() {
  const data = await getProfileSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student settings"
        title="Shape your learning identity and daily preferences."
        description="Update your profile image, public username, contact details, bio, notification rhythm, and leaderboard visibility."
      />
      <ProfileSettingsPanel data={data} role="student" />
    </div>
  );
}
