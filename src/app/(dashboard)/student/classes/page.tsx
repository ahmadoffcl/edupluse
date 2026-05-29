import { PageHeader } from "@/components/dashboard/page-header";
import { StudentClassesPanel } from "@/components/student/student-classes-panel";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentClassesPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Classes"
        title="Your classrooms and class discovery."
        description="Open enrolled classrooms, request suggested sections, and keep pending approvals in one organized view."
      />
      <StudentClassesPanel classes={data.classes} />
    </div>
  );
}
