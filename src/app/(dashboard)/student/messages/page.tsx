import { MessageCircle, MessageSquareText, Radio } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StudentMessagesPanel } from "@/components/student/student-messages-panel";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentMessagesPage() {
  const data = await getDashboardData();
  const unread = data.messages.reduce(
    (total, thread) => total + thread.unread,
    0,
  );
  const stats: Array<[string, number, LucideIcon]> = [
    ["Threads", data.messages.length, MessageSquareText],
    ["Unread", unread, Radio],
    ["Classes", data.classes.length, MessageCircle],
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Messages"
        title="Class conversations and teacher updates."
        description="Real class messages, announcements, and direct conversations appear here as your workspace becomes active."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {stats.map(([label, value, Icon]) => (
          <Card key={String(label)}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{String(value)}</p>
              </div>
              <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <StudentMessagesPanel messages={data.messages} classes={data.classes} />
    </div>
  );
}
