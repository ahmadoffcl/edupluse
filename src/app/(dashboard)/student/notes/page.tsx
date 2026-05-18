import { NotesPanel } from "@/components/dashboard/content-blocks";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentNotesPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Notes"
        title="Searchable subject notes and resources."
        description="Daily notes, subject-wise material, rich notes, PDFs, videos, and instant search."
        action="Search notes"
        items={[
          {
            title: "Physics",
            meta: "Momentum, forces, lab notes",
            stat: "12 notes",
            tone: "info",
          },
          {
            title: "Mathematics",
            meta: "Algebra, functions, worksheets",
            stat: "18 notes",
            tone: "success",
          },
          {
            title: "English",
            meta: "Essays, literature, grammar",
            stat: "9 notes",
            tone: "warning",
          },
        ]}
      />
      <NotesPanel items={data.notes} />
    </div>
  );
}
