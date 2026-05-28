import { IdMakerPanel } from "@/components/admin/id-maker-panel";
import { PageHeader } from "@/components/dashboard/page-header";

export default function AdminIdMakerPage() {
  return (
    <div>
      <PageHeader
        eyebrow="ID Maker"
        title="Create login IDs for teachers and students."
        description="Build real Firebase accounts, connect them to EduPulse, and let users sign in with the credentials you assign."
      />
      <IdMakerPanel />
    </div>
  );
}
