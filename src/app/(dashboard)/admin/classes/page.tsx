import { AdminClassesPanel } from "@/components/admin/admin-classes-panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAdminClassesData } from "@/lib/dashboard/admin-classes";

export default async function AdminClassesPage() {
  const data = await getAdminClassesData();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Class control"
        title="Manage every class."
        description="Edit class details, assign teachers, update capacity and schedule notes, and archive old classrooms."
      />
      <AdminClassesPanel classes={data.classes} teachers={data.teachers} />
    </div>
  );
}
