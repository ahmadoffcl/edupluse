import { AdminContactPanel } from "@/components/admin/admin-contact-panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAdminContactRequests } from "@/lib/dashboard/admin-contact";

export default async function AdminContactPage() {
  const requests = await getAdminContactRequests();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contact inbox"
        title="Read support requests and reply from the admin dashboard."
        description="Messages sent from the public contact page land here with sender details, status, and admin response history."
      />
      <AdminContactPanel requests={requests} />
    </div>
  );
}
