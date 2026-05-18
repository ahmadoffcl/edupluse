import { NotesPanel } from "@/components/dashboard/content-blocks";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function TeacherUploadsPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Content uploads"
        title="Upload notes, PDFs, videos, and lesson material."
        description="Organize resources by subject, class, batch, term, and moderation status."
        action="Upload resource"
        items={[
          {
            title: "PDF resources",
            meta: "Ready for students",
            stat: "84",
            tone: "success",
          },
          {
            title: "Video lessons",
            meta: "Streaming links",
            stat: "21",
            tone: "info",
          },
          {
            title: "Pending moderation",
            meta: "Admin review",
            stat: "4",
            tone: "warning",
          },
        ]}
      />
      <NotesPanel teacher items={data.notes} />
    </div>
  );
}
