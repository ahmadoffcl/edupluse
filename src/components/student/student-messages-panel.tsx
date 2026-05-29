"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquareText, Send, UsersRound } from "lucide-react";
import { toast } from "sonner";
import {
  EmptyState,
  MessagesPanel,
} from "@/components/dashboard/content-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import type { StudentClassRow } from "@/lib/dashboard/server-data";
import type { MessageThread } from "@/lib/types";

type ClassmateOption = {
  id: string;
  label: string;
  classId: string;
  className: string;
};

export function StudentMessagesPanel({
  messages,
  classes,
}: {
  messages: MessageThread[];
  classes: StudentClassRow[];
}) {
  const router = useRouter();
  const [classId, setClassId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);

  const enrolledClasses = useMemo(
    () =>
      classes.filter(
        (classRecord) => classRecord.enrollmentStatus === "enrolled",
      ),
    [classes],
  );
  const activeClassId = classId || enrolledClasses[0]?.id || "";
  const classmates = useMemo<ClassmateOption[]>(() => {
    return enrolledClasses.flatMap((classRecord) =>
      classRecord.classmates.map((classmate) => ({
        id: classmate.id,
        label: classmate.username ? `@${classmate.username}` : classmate.name,
        classId: classRecord.id,
        className: classRecord.name,
      })),
    );
  }, [enrolledClasses]);
  const visibleClassmates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return classmates
      .filter((classmate) => classmate.classId === activeClassId)
      .filter((classmate) =>
        normalized
          ? `${classmate.label} ${classmate.className}`
              .toLowerCase()
              .includes(normalized)
          : true,
      );
  }, [activeClassId, classmates, query]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeClassId || !recipientId) {
      toast.error("Choose a class and classmate first.");
      return;
    }

    const form = new FormData(event.currentTarget);
    setSending(true);
    try {
      const response = await fetch("/api/student/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: activeClassId,
          recipientId,
          body: String(form.get("body") ?? ""),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ?? "Unable to send message.");
      }
      toast.success("Message sent.");
      event.currentTarget.reset();
      setRecipientId("");
      router.refresh();
    } catch (error) {
      toast.error("Message failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <MessagesPanel items={messages} />

      <div className="space-y-4 xl:sticky xl:top-32 xl:self-start">
        <Card className="overflow-hidden">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Message a classmate</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick someone from your enrolled classes.
                </p>
              </div>
              <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <MessageSquareText className="size-5" />
              </span>
            </div>

            {enrolledClasses.length === 0 ? (
              <EmptyState
                variant="messages"
                message="Join a class before starting classmate messages."
              />
            ) : (
              <form className="space-y-3" onSubmit={sendMessage}>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Class
                  </label>
                  <select
                    value={activeClassId}
                    onChange={(event) => {
                      setClassId(event.target.value);
                      setRecipientId("");
                    }}
                    className="h-11 rounded-2xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {enrolledClasses.map((classRecord) => (
                      <option key={classRecord.id} value={classRecord.id}>
                        {classRecord.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search classmates"
                />

                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {visibleClassmates.length === 0 ? (
                    <div className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
                      No classmates found in this class yet.
                    </div>
                  ) : (
                    visibleClassmates.map((classmate) => (
                      <button
                        key={`${classmate.classId}-${classmate.id}`}
                        type="button"
                        onClick={() => setRecipientId(classmate.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                          recipientId === classmate.id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background/70 hover:bg-muted"
                        }`}
                      >
                        <span className="grid size-9 place-items-center rounded-full bg-muted">
                          <UsersRound className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {classmate.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {classmate.className}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <Textarea
                  name="body"
                  required
                  placeholder="Write a clear class message..."
                  className="min-h-28"
                />
                <Button className="w-full" disabled={sending}>
                  <Send />
                  {sending ? "Sending..." : "Send message"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Class channels</h2>
              <Badge variant="secondary">{classes.length}</Badge>
            </div>
            {classes.length === 0 ? (
              <EmptyState
                variant="messages"
                message="Class channels appear after you are enrolled."
              />
            ) : (
              classes.slice(0, 6).map((classRecord) => (
                <Link
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
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
