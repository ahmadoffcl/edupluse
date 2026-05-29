import { PageHeader } from "@/components/dashboard/page-header";
import { StudentMissionsPanel } from "@/components/student/student-missions-panel";

export default function StudentMissionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily Focus"
        title="Know exactly what to do next."
        description="Smart Learning Missions turn your real classwork into a simple checklist: finish urgent work, review feedback, open new teacher files, and keep momentum."
      />
      <StudentMissionsPanel />
    </div>
  );
}
