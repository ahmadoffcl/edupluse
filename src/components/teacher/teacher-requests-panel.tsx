"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  Search,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/content-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TeacherClassJoinRequestRow } from "@/lib/dashboard/teacher-workflow";
import { formatDateTime, initials } from "@/lib/utils";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const filters: StatusFilter[] = ["pending", "approved", "rejected", "all"];

function studentHandle(request: TeacherClassJoinRequestRow) {
  if (request.studentUsername) return `@${request.studentUsername}`;
  return request.studentEmail ?? "Student account";
}

export function TeacherRequestsPanel({
  requests,
}: {
  requests: TeacherClassJoinRequestRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === "pending")
        .length,
      approved: requests.filter((request) => request.status === "approved")
        .length,
      rejected: requests.filter((request) => request.status === "rejected")
        .length,
      all: requests.length,
    }),
    [requests],
  );

  const filteredRequests = useMemo(() => {
    const search = query.trim().toLowerCase();
    return requests
      .filter((request) => filter === "all" || request.status === filter)
      .filter((request) => {
        if (!search) return true;
        return [
          request.studentName,
          request.studentUsername,
          request.studentEmail,
          request.className,
          request.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);
      });
  }, [filter, query, requests]);

  async function reviewRequest(
    request: TeacherClassJoinRequestRow,
    decision: "approved" | "rejected",
  ) {
    setBusyId(request.id);
    try {
      const response = await fetch(
        `/api/teacher/classes/${request.classId}/join-requests/${request.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to review request.");
      }

      toast.success(
        decision === "approved"
          ? `${request.studentName} can now enter ${request.className}.`
          : "Join request declined.",
      );
      router.refresh();
    } catch (error) {
      toast.error("Request action failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Waiting", counts.pending, "Students asking to join", "warning"],
          ["Approved", counts.approved, "Recently accepted", "success"],
          ["Declined", counts.rejected, "Rejected requests", "secondary"],
          ["Total", counts.all, "All request history", "info"],
        ].map(([label, value, meta, variant]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
                </div>
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                  {label === "Approved" ? (
                    <UserCheck className="size-4" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                </span>
              </div>
              <Badge
                variant={
                  variant as "warning" | "success" | "secondary" | "info"
                }
                className="mt-4"
              >
                {label}
              </Badge>
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
              placeholder="Search student, username, class, or status"
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

      {filteredRequests.length === 0 ? (
        <EmptyState
          variant="messages"
          message="No student join requests match this view yet."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredRequests.map((request, index) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: index * 0.025 }}
              className="rounded-[1.5rem] border border-border bg-card/76 p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {initials(request.studentName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">
                      {request.studentName}
                    </p>
                    <Badge
                      variant={
                        request.status === "pending"
                          ? "warning"
                          : request.status === "approved"
                            ? "success"
                            : "secondary"
                      }
                    >
                      {request.status}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {studentHandle(request)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background/55 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Classroom
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">
                    {request.className}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <Clock3 className="size-3" /> Requested
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold">
                    {formatDateTime(request.requestedAt)}
                  </p>
                </div>
              </div>

              {request.status === "pending" ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => reviewRequest(request, "approved")}
                  >
                    <CheckCircle2 />
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === request.id}
                    onClick={() => reviewRequest(request, "rejected")}
                  >
                    <XCircle />
                    Decline
                  </Button>
                </div>
              ) : null}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
