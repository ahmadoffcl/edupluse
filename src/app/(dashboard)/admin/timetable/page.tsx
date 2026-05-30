import { TimetableImportPanel } from "@/components/admin/timetable-import-panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAdminTimetableData } from "@/lib/dashboard/admin-timetable";

export default async function AdminTimetablePage() {
  const data = await getAdminTimetableData();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Class alerts"
        title="Timetable notifications."
        description="Import the CS section timetable, review each class slot, and send start and end reminders only to enrolled students."
      />
      <TimetableImportPanel
        imports={data.imports}
        slots={data.slots}
        classes={data.classes}
      />
    </div>
  );
}
