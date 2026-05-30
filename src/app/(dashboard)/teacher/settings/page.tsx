import { PageHeader } from "@/components/dashboard/page-header";
import { ProfileSettingsPanel } from "@/components/profile/profile-settings-panel";
import { TeacherInviteSettingsPanel } from "@/components/teacher/teacher-invite-settings-panel";
import { getProfileSettings } from "@/lib/dashboard/profile-settings";
import { getTeacherWorkflowData } from "@/lib/dashboard/teacher-workflow";

export default async function TeacherSettingsPage() {
  const [data, workflowData] = await Promise.all([
    getProfileSettings(),
    getTeacherWorkflowData(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Teacher settings"
        title="Tune your teaching profile and classroom preferences."
        description="Update your profile image, public username, contact details, teacher bio, notifications, digest, and leaderboard visibility."
      />
      <TeacherInviteSettingsPanel data={workflowData} />
      <ProfileSettingsPanel data={data} role="teacher" />
    </div>
  );
}
