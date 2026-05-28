import { PageHeader } from "@/components/dashboard/page-header";
import { ProfileSettingsPanel } from "@/components/profile/profile-settings-panel";
import { getProfileSettings } from "@/lib/dashboard/profile-settings";

export default async function TeacherSettingsPage() {
  const data = await getProfileSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Teacher settings"
        title="Tune your teaching profile and classroom preferences."
        description="Update your profile image, public username, contact details, teacher bio, notifications, digest, and leaderboard visibility."
      />
      <ProfileSettingsPanel data={data} role="teacher" />
    </div>
  );
}
