import { FeaturePage } from "@/components/dashboard/feature-page";
import { moderationQueue } from "@/lib/mock-data";

export default function AdminModerationPage() {
  return (
    <FeaturePage
      eyebrow="Moderation"
      title="Review uploads, discussions, announcements, and flagged content."
      description="A focused moderation queue keeps collaboration safe without slowing teachers down."
      action="Review queue"
      items={moderationQueue.slice(0, 3).map((item, index) => ({
        title: item,
        meta: "Requires admin decision",
        stat: index === 0 ? "High" : "Open",
        tone: index === 0 ? "warning" : "info",
      }))}
    />
  );
}
