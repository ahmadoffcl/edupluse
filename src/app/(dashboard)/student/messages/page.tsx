import { MessagesPanel } from "@/components/dashboard/content-blocks";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentMessagesPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Messages"
        title="Teacher-student communication and class discussions."
        description="Class chat, direct messages, announcements, and moderated discussion threads."
        action="New message"
        items={[
          {
            title: "Physics 10-A",
            meta: "Class channel",
            stat: "3 unread",
            tone: "info",
          },
          {
            title: "Ms. Noor",
            meta: "Teacher",
            stat: "1 unread",
            tone: "warning",
          },
          {
            title: "Study Squad",
            meta: "Group thread",
            stat: "Open",
            tone: "success",
          },
        ]}
      />
      <MessagesPanel items={data.messages} />
    </div>
  );
}
