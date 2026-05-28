import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileText,
  MessageSquareText,
  Paperclip,
  Trophy,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  FileDownloadButton,
  FilePreviewButton,
} from "@/components/files/file-preview-dialog";
import { StudentAssignmentSubmissionForm } from "@/components/student/student-assignments-panel";
import { StudentUnsubmitButton } from "@/components/student/student-unsubmit-button";
import type { Assignment } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function daysLeft(value: string) {
  const due = new Date(value).getTime();
  if (Number.isNaN(due)) return null;

  return Math.ceil((due - Date.now()) / (1000 * 60 * 60 * 24));
}

function deadlineLabel(value: string) {
  const days = daysLeft(value);
  if (days === null) return "No deadline";
  if (days < 0)
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

export function StudentAssignmentDetail({
  assignment,
  uploadFocused = false,
}: {
  assignment: Assignment;
  uploadFocused?: boolean;
}) {
  const canSubmit =
    assignment.status === "pending" || assignment.status === "late";
  const canUnsubmit =
    Boolean(assignment.submittedAt) &&
    (assignment.status === "submitted" || assignment.status === "late");
  const progress =
    assignment.status === "graded"
      ? 100
      : assignment.status === "submitted"
        ? 75
        : assignment.status === "late"
          ? 35
          : 45;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Button asChild size="sm" variant="ghost" className="px-0">
        <Link href="/student/assignments">
          <ArrowLeft /> Back to assignments
        </Link>
      </Button>

      <section className="relative overflow-hidden rounded-[1.25rem] border border-border bg-[#06070b] p-4 text-white shadow-[var(--shadow-soft)] sm:rounded-[1.5rem] sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(124,156,255,0.35),transparent_34%),radial-gradient(circle_at_86%_16%,rgba(255,180,84,0.24),transparent_30%),linear-gradient(135deg,#020309,#101422,#0b0d13)]" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-white/10 text-white">
              {assignment.className}
            </Badge>
            <Badge className="border-white/15 bg-white/10 text-white">
              {assignment.subject}
            </Badge>
          </div>
          <h1 className="mt-3 text-xl font-semibold leading-tight tracking-tight sm:mt-4 sm:text-2xl md:text-4xl">
            {assignment.title}
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/72 sm:mt-3 sm:text-sm sm:leading-6">
            {assignment.instructions ||
              "Review the requirements, attach your work, and submit before the deadline."}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ["Deadline", deadlineLabel(assignment.dueDate)],
              ["Points", `${assignment.points}`],
              ["Status", assignment.status],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/10 p-3"
              >
                <p className="text-[11px] uppercase text-white/55">{label}</p>
                <p className="mt-1 truncate text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:gap-6">
        <main className="space-y-4 sm:space-y-5">
          <Card
            className={uploadFocused ? "border-primary/30 bg-primary/5" : ""}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="size-5 text-primary" />
                Upload assignment
              </CardTitle>
              <CardDescription>
                Submit a file, a note, or both. Your teacher will see the date
                and time instantly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {canSubmit ? (
                <StudentAssignmentSubmissionForm assignment={assignment} />
              ) : (
                <div className="rounded-2xl border border-border bg-background/60 p-3 sm:p-4">
                  <p className="font-semibold">Submission is closed</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This assignment is already {assignment.status}.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {assignment.attachments?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="size-5 text-primary" />
                  Teacher attachments
                </CardTitle>
                <CardDescription>
                  Open the files your teacher attached to this assignment.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 sm:gap-3">
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
                      className="min-w-0 rounded-2xl border border-border bg-background/60 p-3 transition hover:-translate-y-1 hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                          <FileText className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {attachment.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Teacher file
                          </span>
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <FilePreviewButton file={file} />
                        <FileDownloadButton file={file} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          {(assignment.submissionContent ||
            assignment.submissionFileUrl ||
            assignment.feedback) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="size-5 text-primary" />
                  Your submission history
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignment.submittedAt ? (
                  <div className="rounded-2xl border border-border bg-background/60 p-3 sm:p-4">
                    <p className="font-semibold">
                      Submitted {formatDate(assignment.submittedAt)}
                    </p>
                    {assignment.submissionContent ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {assignment.submissionContent}
                      </p>
                    ) : null}
                    {assignment.submissionFileUrl ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <FilePreviewButton
                          file={{
                            name:
                              assignment.submissionFilePath?.split("/").pop() ??
                              "Submitted file",
                            signedUrl: assignment.submissionFileUrl,
                            downloadName:
                              assignment.submissionFilePath?.split("/").pop() ??
                              "submitted-file",
                            source: "submission",
                          }}
                        />
                        <FileDownloadButton
                          file={{
                            name:
                              assignment.submissionFilePath?.split("/").pop() ??
                              "Submitted file",
                            signedUrl: assignment.submissionFileUrl,
                            downloadName:
                              assignment.submissionFilePath?.split("/").pop() ??
                              "submitted-file",
                            source: "submission",
                          }}
                        />
                      </div>
                    ) : null}
                    {canUnsubmit ? (
                      <StudentUnsubmitButton
                        assignmentId={assignment.id}
                        className="mt-3"
                      />
                    ) : null}
                  </div>
                ) : null}
                {assignment.feedback ? (
                  <div className="rounded-2xl border border-border bg-muted p-3 sm:p-4">
                    <p className="font-semibold">Teacher feedback</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {assignment.feedback}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </main>

        <aside className="space-y-3 sm:space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border bg-background/60 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Status</span>
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
                <Progress className="mt-4" value={progress} />
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-3 sm:p-4">
                <CalendarClock className="mb-2 size-5 text-primary sm:mb-3" />
                <p className="font-semibold">
                  {deadlineLabel(assignment.dueDate)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(assignment.dueDate)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-3 sm:p-4">
                <Trophy className="mb-2 size-5 text-primary sm:mb-3" />
                <p className="font-semibold">{assignment.points} points</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {assignment.grade
                    ? `Current grade: ${assignment.grade}`
                    : "Grade appears after teacher review"}
                </p>
              </div>
              {assignment.submittedAt ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 sm:p-4">
                  <CheckCircle2 className="mb-2 size-5 text-emerald-500 sm:mb-3" />
                  <p className="font-semibold">Work received</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your latest upload is connected to this assignment.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
