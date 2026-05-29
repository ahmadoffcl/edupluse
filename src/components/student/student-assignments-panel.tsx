"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Eye,
  FileUp,
  Paperclip,
  Search,
  Send,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/content-blocks";
import {
  FileDownloadButton,
  FilePreviewButton,
} from "@/components/files/file-preview-dialog";
import { StudentUnsubmitButton } from "@/components/student/student-unsubmit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import type { Assignment, AssignmentStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const ASSIGNMENT_PAGE_SIZE = 12;

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Submitted", value: "submitted" },
  { label: "Graded", value: "graded" },
  { label: "Late", value: "late" },
] satisfies Array<{ label: string; value: AssignmentStatus | "all" }>;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function StudentAssignmentsPanel({
  assignments,
}: {
  assignments: Assignment[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AssignmentStatus | "all">("all");
  const [visibleCount, setVisibleCount] = useState(ASSIGNMENT_PAGE_SIZE);
  const reduceMotion = useReducedMotion();

  const filteredAssignments = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const matchesStatus = status === "all" || assignment.status === status;
      if (!matchesStatus) return false;
      if (!normalized) return true;

      return [
        assignment.title,
        assignment.subject,
        assignment.className,
        assignment.instructions,
        assignment.feedback,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [assignments, query, status]);

  const visibleAssignments = filteredAssignments.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      {assignments.length === 0 ? (
        <EmptyState
          variant="assignments"
          message="No assignments are available yet."
        />
      ) : null}

      {assignments.length > 0 ? (
        <Card className="sticky top-3 z-10 border-border/70 bg-card/88 backdrop-blur-xl lg:top-24">
          <CardContent className="grid gap-3 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search assignments, classes, subjects, or feedback"
                className="pl-11"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatus(filter.value)}
                  className={cn(
                    "inline-flex min-w-fit items-center rounded-full px-4 py-2 text-sm font-semibold transition",
                    status === filter.value
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                  )}
                >
                  {filter.label}
                </button>
              ))}
              <Badge variant="secondary" className="min-w-fit">
                {filteredAssignments.length} result
                {filteredAssignments.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {assignments.length > 0 && filteredAssignments.length === 0 ? (
        <EmptyState
          variant="assignments"
          message="No assignments match your search or filter."
        />
      ) : null}

      {visibleAssignments.map((assignment, index) => {
        const canSubmit =
          assignment.status === "pending" || assignment.status === "late";

        return (
          <motion.div
            key={assignment.id}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: Math.min(index, 8) * 0.03 }}
          >
            <Card className="overflow-hidden bg-card/72 shadow-[0_18px_60px_-48px_rgba(0,0,0,0.8)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)]">
              <CardHeader className="border-b border-border/70 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="line-clamp-2">
                      {assignment.title}
                    </CardTitle>
                    <CardDescription>
                      {assignment.subject} - {assignment.className}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      assignment.status === "graded"
                        ? "success"
                        : assignment.status === "late"
                          ? "danger"
                          : assignment.status === "submitted"
                            ? "info"
                            : "warning"
                    }
                  >
                    {assignment.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                  <div className="rounded-2xl border border-border bg-background/55 p-3">
                    <Clock className="mb-2 size-4 text-primary" />
                    <p className="text-sm font-semibold">
                      {formatDateTime(assignment.dueDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">Deadline</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/55 p-3">
                    <Paperclip className="mb-2 size-4 text-primary" />
                    <p className="text-sm font-semibold">
                      {assignment.attachments?.length ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Teacher files
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/55 p-3 max-sm:col-span-2">
                    <FileUp className="mb-2 size-4 text-primary" />
                    <p className="text-sm font-semibold">
                      {assignment.submittedAt
                        ? formatDate(assignment.submittedAt)
                        : "Not submitted"}
                    </p>
                    <p className="text-xs text-muted-foreground">Your work</p>
                  </div>
                </div>

                {assignment.instructions ? (
                  <p className="line-clamp-3 rounded-2xl border border-border bg-background/55 p-3 text-sm leading-6 text-muted-foreground">
                    {assignment.instructions}
                  </p>
                ) : null}

                {assignment.attachments?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {assignment.attachments.map((attachment) => {
                      const file = {
                        name: attachment.name,
                        mimeType: attachment.mimeType,
                        signedUrl: attachment.signedUrl,
                        downloadName: attachment.name,
                        source: "assignment" as const,
                      };
                      return (
                        <div
                          key={attachment.path}
                          className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/70 p-2"
                        >
                          <span className="inline-flex min-w-0 items-center gap-2 px-1 text-sm">
                            <Paperclip className="size-4 shrink-0 text-primary" />
                            <span className="truncate">{attachment.name}</span>
                          </span>
                          <FilePreviewButton file={file} />
                          <FileDownloadButton file={file} />
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {assignment.feedback ? (
                  <div className="rounded-2xl border border-border bg-muted p-3 sm:p-4">
                    <p className="text-sm font-semibold">Teacher feedback</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {assignment.feedback}
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <Link href={`/student/assignments/${assignment.id}`}>
                      <Eye /> View details
                    </Link>
                  </Button>
                  {canSubmit ? (
                    <Button asChild className="w-full sm:w-auto">
                      <Link
                        href={`/student/assignments/${assignment.id}/submit`}
                      >
                        <UploadCloud /> Upload work
                      </Link>
                    </Button>
                  ) : null}
                  {(assignment.status === "submitted" ||
                    assignment.status === "late") &&
                  assignment.submittedAt ? (
                    <StudentUnsubmitButton
                      assignmentId={assignment.id}
                      className="w-full sm:w-auto"
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      {filteredAssignments.length > visibleAssignments.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setVisibleCount((count) => count + ASSIGNMENT_PAGE_SIZE)
            }
          >
            Load more assignments
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function StudentAssignmentSubmissionForm({
  assignment,
}: {
  assignment: Assignment;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("assignmentId", assignment.id);
    setBusy(true);

    try {
      const response = await fetch("/api/student/submissions", {
        method: "POST",
        body: form,
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to submit assignment.");
      }

      toast.success("Assignment submitted.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      toast.error("Submission failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-[1.5rem] border border-border bg-background/58 p-3 sm:p-4">
        <label className="text-sm font-semibold">Submission note</label>
        <Textarea
          className="mt-2 min-h-28 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          name="content"
          placeholder="Add a short note for your teacher, such as what file you attached or where to review your work."
          defaultValue={assignment.submissionContent ?? ""}
        />
      </div>

      <label className="group block cursor-pointer rounded-[1.5rem] border border-dashed border-primary/35 bg-primary/5 p-4 transition hover:-translate-y-0.5 hover:bg-primary/10">
        <Input
          name="file"
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.webm,.mp4,.mov"
          className="sr-only"
          onChange={(event) =>
            setFileName(event.currentTarget.files?.[0]?.name ?? "")
          }
        />
        <span className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            {fileName ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <UploadCloud className="size-5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {fileName || "Choose assignment file"}
            </span>
            <span className="block text-sm text-muted-foreground">
              PDF, Word, slides, spreadsheets, images, audio, video, or text.
            </span>
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          You can submit a note, a file, or both. Your teacher sees the latest
          upload time.
        </p>
        <Button className="w-full sm:w-auto" disabled={busy}>
          <Send /> {busy ? "Submitting..." : "Submit work"}
        </Button>
      </div>
    </form>
  );
}
