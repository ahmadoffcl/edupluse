"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Reply, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/content-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import type { AdminContactRequest } from "@/lib/dashboard/admin-contact";
import { formatDateTime, initials } from "@/lib/utils";

type Filter = "open" | "replied" | "closed" | "all";

const filters: Filter[] = ["open", "replied", "closed", "all"];

export function AdminContactPanel({
  requests,
}: {
  requests: AdminContactRequest[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return requests
      .filter((request) => filter === "all" || request.status === filter)
      .filter((request) => {
        if (!search) return true;
        return [
          request.name,
          request.email,
          request.institute,
          request.subject,
          request.message,
          request.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);
      });
  }, [filter, query, requests]);

  async function reply(
    event: FormEvent<HTMLFormElement>,
    request: AdminContactRequest,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId(request.id);

    try {
      const response = await fetch(`/api/admin/contact/${request.id}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyBody: String(form.get("replyBody") ?? ""),
          close: form.get("close") === "on",
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ?? "Unable to save reply.");
      }

      toast.success("Reply saved in admin inbox.");
      router.refresh();
    } catch (error) {
      toast.error("Reply failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Open", requests.filter((item) => item.status === "open").length],
          [
            "Replied",
            requests.filter((item) => item.status === "replied").length,
          ],
          ["Total", requests.length],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-semibold">{value}</p>
              </div>
              <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                <Mail className="size-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3 p-3 md:flex md:items-center md:gap-3 md:space-y-0">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, institute, or message"
              className="pl-11"
            />
          </div>
          <div className="grid grid-cols-4 gap-2 rounded-full border border-border bg-muted/45 p-1">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-full px-3 py-2 text-xs font-semibold capitalize transition ${
                  filter === item
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          variant="messages"
          message="No contact requests match this inbox view."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((request, index) => (
            <motion.article
              key={request.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: index * 0.025 }}
              className="rounded-[1.5rem] border border-border bg-card/76 p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {initials(request.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{request.name}</h2>
                    <Badge
                      variant={
                        request.status === "open"
                          ? "warning"
                          : request.status === "replied"
                            ? "success"
                            : "secondary"
                      }
                    >
                      {request.status}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {request.email}
                    {request.institute ? ` - ${request.institute}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-background/55 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {formatDateTime(request.createdAt)}
                </p>
                <h3 className="mt-2 font-semibold">{request.subject}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {request.message}
                </p>
              </div>

              {request.replyBody ? (
                <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm">
                  <p className="mb-2 flex items-center gap-2 font-semibold">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    Admin reply
                  </p>
                  <p className="leading-6 text-muted-foreground">
                    {request.replyBody}
                  </p>
                  {request.repliedAt ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDateTime(request.repliedAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <form
                className="mt-3 space-y-3"
                onSubmit={(event) => reply(event, request)}
              >
                <Textarea
                  name="replyBody"
                  placeholder="Write an admin reply or internal response note"
                  defaultValue={request.replyBody ?? ""}
                  required
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <input
                      name="close"
                      type="checkbox"
                      className="size-4 accent-primary"
                      defaultChecked={request.status === "closed"}
                    />
                    Close after reply
                  </label>
                  <Button disabled={busyId === request.id} variant="premium">
                    <Reply />
                    {busyId === request.id ? "Saving..." : "Save reply"}
                  </Button>
                </div>
              </form>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
