import { InviteManagement } from "@/components/admin/invite-management";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAdminInvitesData } from "@/lib/dashboard/admin-invites";

export default async function AdminInvitesPage() {
  const data = await getAdminInvitesData();

  return (
    <div>
      <PageHeader
        eyebrow="Onboarding control"
        title="Invite students, teachers, and staff into the right institution workflow."
        description="Create secure invite links and codes with role, expiration, department, class, section, usage limits, and personal messages."
      />
      <InviteManagement data={data} />
    </div>
  );
}
