import { PageHeader } from "@/components/dashboard/page-header";
import { StudentNotesManager } from "@/components/student/student-notes-manager";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentNotesPage() {
  const data = await getDashboardData();

  return (
    <div>
      <PageHeader
        eyebrow="Notes"
        title="Your study library."
        description="Upload private notes, attach class notes, open teacher materials, and keep everything searchable from real workspace data."
      />
      <StudentNotesManager notes={data.notes} classes={data.classes} />
    </div>
  );
}
