import { MessageCircle, MessageSquareText, Radio } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  EmptyState,
  MessagesPanel,
} from "@/components/dashboard/content-blocks";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
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

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <MessagesPanel items={data.messages} />
        <Card className="xl:sticky xl:top-24 xl:self-start">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Class channels</h2>
              <Badge variant="secondary">{data.classes.length}</Badge>
            </div>
            {data.classes.length === 0 ? (
              <EmptyState
                variant="messages"
                message="Class channels appear after you are enrolled."
              />
            ) : (
              data.classes.slice(0, 6).map((classRecord) => (
                <a
                  key={classRecord.id}
                  href={`/student/classes/${classRecord.id}?tab=stream`}
                  className="block rounded-2xl border border-border bg-background/60 p-3 transition hover:-translate-y-1 hover:bg-muted"
                >
                  <p className="truncate text-sm font-semibold">
                    {classRecord.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {classRecord.teacherName ?? "Class stream"} -{" "}
                    {classRecord.announcementCount} posts
                  </p>
                </a>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
