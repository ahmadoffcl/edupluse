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

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map(([label, value, Icon]) => (
          <Card key={String(label)} className="overflow-hidden">
            <CardContent className="p-2 text-center sm:flex sm:items-center sm:justify-between sm:gap-3 sm:p-4 sm:text-left">
              <div className="min-w-0">
                <p className="truncate text-[10px] text-muted-foreground sm:text-sm">
                  {label}
                </p>
                <p className="mt-1 text-base font-semibold leading-5 sm:text-2xl">
                  {String(value)}
                </p>
              </div>
              <span className="mx-auto mt-1 grid size-8 place-items-center rounded-2xl bg-primary/10 text-primary sm:mx-0 sm:mt-0 sm:size-10">
                <Icon className="size-4 sm:size-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <StudentMessagesPanel messages={data.messages} classes={data.classes} />
    </div>
  );
}
