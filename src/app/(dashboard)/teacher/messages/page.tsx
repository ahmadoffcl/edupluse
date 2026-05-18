import { MessagesPanel } from "@/components/dashboard/content-blocks";
import { FeaturePage } from "@/components/dashboard/feature-page";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function TeacherMessagesPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <FeaturePage
        eyebrow="Messaging"
        title="Announcements, class channels, and student support."
        description="Send announcements, answer questions, and keep class discussions structured."
        action="New announcement"
        items={[
          {
            title: "Class channels",
            meta: "Active rooms",
            stat: "9",
            tone: "info",
          },
          {
            title: "Direct messages",
            meta: "Needs reply",
            stat: "14",
            tone: "warning",
          },
          {
            title: "Announcements",
            meta: "Sent this week",
            stat: "6",
            tone: "success",
          },
        ]}
      />
      <MessagesPanel items={data.messages} />
    </div>
  );
}
