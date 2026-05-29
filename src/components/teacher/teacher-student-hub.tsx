"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CheckCircle2,
  MessageSquareText,
  Search,
  Trash2,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/content-blocks";
import {
  FileDownloadButton,
  FilePreviewButton,
} from "@/components/files/file-preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type {
  TeacherClassOption,
  TeacherStudentOption,
  TeacherWorkflowData,
} from "@/lib/dashboard/teacher-workflow";
import { formatDate, initials } from "@/lib/utils";

function bandVariant(band?: string) {
  if (band === "high_momentum") return "success";
  if (band === "steady") return "info";
  if (band === "watch") return "warning";
  return "danger";
}

function displayStudent(student: TeacherStudentOption) {
  return student.username ? `@${student.username}` : student.name;
}

function StudentDrawer({
  data,
  classRecord,
  student,
}: {
  data: TeacherWorkflowData;
  classRecord: TeacherClassOption;
  student: TeacherStudentOption;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const performance = data.performance.find(
    (row) => row.profileId === student.id,
  );
  const assignments = data.assignmentRows.filter(
    (assignment) => assignment.classId === classRecord.id,
  );
  const submissions = data.submissions.filter(
    (submission) =>
      submission.classId === classRecord.id &&
      submission.studentId === student.id,
  );

  async function removeStudent() {
    setBusy("remove");
    try {
      const response = await fetch(
        `/api/teacher/classes/${classRecord.id}/students`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: student.id }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to remove student.");
      }
      toast.success("Student removed from class.");
      router.refresh();
    } catch (error) {
      toast.error("Student could not be removed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("message");
    try {
      const response = await fetch("/api/teacher/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: classRecord.id,
          recipientId: student.id,
          title: `${classRecord.name} - ${student.name}`,
          body: String(form.get("body") ?? ""),
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to send message.");
      }
      toast.success("Message sent.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      toast.error("Message failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="flex w-full items-center gap-3 rounded-3xl border border-border bg-background/62 p-3 text-left transition hover:-translate-y-0.5 hover:bg-muted">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials(student.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {student.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {displayStudent(student)}
            </span>
          </span>
          <Badge variant={bandVariant(performance?.band)}>
            {performance?.performanceScore ?? 0}
          </Badge>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/68 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 right-0 top-0 z-[90] flex w-full max-w-2xl flex-col border-l border-border bg-card p-4 shadow-2xl outline-none sm:p-5">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {initials(student.name)}
              </span>
              <div className="min-w-0">
                <Dialog.Title className="truncate text-lg font-semibold">
                  {student.name}
                </Dialog.Title>
                <Dialog.Description className="truncate text-sm text-muted-foreground">
                  {displayStudent(student)} - {classRecord.name}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button type="button" size="icon" variant="ghost">
                <X />
              </Button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-auto py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Performance", performance?.performanceScore ?? 0],
                ["Submitted", `${performance?.submittedPercent ?? 0}%`],
                ["Missing", performance?.missingCount ?? 0],
                ["Late", performance?.lateCount ?? 0],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-background/60 p-3"
                >
                  <p className="text-lg font-semibold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {performance ? (
              <div className="rounded-3xl border border-border bg-background/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" />
                    <p className="font-semibold">Learning momentum</p>
                  </div>
                  <Badge variant={bandVariant(performance.band)}>
                    {performance.band.replace("_", " ")}
                  </Badge>
                </div>
                <Progress value={performance.performanceScore} />
                <p className="mt-3 text-sm text-muted-foreground">
                  Score average {performance.averageScore}% - {performance.xp}{" "}
                  XP
                </p>
              </div>
            ) : null}

            <div className="rounded-3xl border border-border bg-background/60 p-4">
              <p className="mb-3 font-semibold">Assignment status</p>
              <div className="space-y-2">
                {assignments.length === 0 ? (
                  <EmptyState
                    variant="assignments"
                    message="No assignments exist for this class yet."
                  />
                ) : (
                  assignments.map((assignment) => {
                    const submission = submissions.find(
                      (item) => item.assignmentId === assignment.id,
                    );
                    return (
                      <div
                        key={assignment.id}
                        className="rounded-2xl border border-border bg-card/80 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {assignment.title}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {assignment.dueAt
                                ? `Due ${formatDate(assignment.dueAt)}`
                                : "No deadline"}
                            </p>
                          </div>
                          <Badge
                            variant={
                              submission?.status === "graded"
                                ? "success"
                                : submission
                                  ? "info"
                                  : "warning"
                            }
                          >
                            {submission?.status ?? "missing"}
                          </Badge>
                        </div>
                        {submission?.signedUrl ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <FilePreviewButton
                              file={{
                                name:
                                  submission.originalFilename ??
                                  `${assignment.title} submission`,
                                mimeType: submission.mimeType,
                                signedUrl: submission.signedUrl,
                                downloadName:
                                  submission.originalFilename ??
                                  `${assignment.title}-submission`,
                                source: "submission",
                              }}
                            />
                            <FileDownloadButton
                              file={{
                                name:
                                  submission.originalFilename ??
                                  `${assignment.title} submission`,
                                mimeType: submission.mimeType,
                                signedUrl: submission.signedUrl,
                                downloadName:
                                  submission.originalFilename ??
                                  `${assignment.title}-submission`,
                                source: "submission",
                              }}
                            />
                          </div>
                        ) : null}
                        {submission?.feedback ? (
                          <p className="mt-2 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
                            {submission.feedback}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <form
              className="rounded-3xl border border-border bg-background/60 p-4"
              onSubmit={sendMessage}
            >
              <p className="mb-3 flex items-center gap-2 font-semibold">
                <MessageSquareText className="size-4 text-primary" />
                Message student
              </p>
              <Textarea
                required
                name="body"
                placeholder={`Write to ${student.name}`}
              />
              <Button className="mt-3 w-full" disabled={busy === "message"}>
                <MessageSquareText />
                {busy === "message" ? "Sending..." : "Send message"}
              </Button>
            </form>
          </div>

          <div className="border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy === "remove"}
              onClick={removeStudent}
            >
              <Trash2 />
              {busy === "remove" ? "Removing..." : "Remove from class"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TeacherStudentHub({
  data,
  classRecord,
}: {
  data: TeacherWorkflowData;
  classRecord: TeacherClassOption;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const students = useMemo(
    () =>
      data.students
        .filter((student) => student.classIds.includes(classRecord.id))
        .filter((student) => {
          const search = query.trim().toLowerCase();
          if (!search) return true;
          return [student.name, student.username, student.email]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search);
        }),
    [classRecord.id, data.students, query],
  );
  const pendingRequests = data.joinRequests.filter(
    (request) =>
      request.classId === classRecord.id && request.status === "pending",
  );

  async function reviewRequest(
    requestId: string,
    decision: "approved" | "rejected",
  ) {
    setBusyRequestId(requestId);
    try {
      const response = await fetch(
        `/api/teacher/classes/${classRecord.id}/join-requests/${requestId}`,
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
        decision === "approved" ? "Student added." : "Request declined.",
      );
      router.refresh();
    } catch (error) {
      toast.error("Request action failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyRequestId(null);
    }
  }

  return (
    <div className="space-y-4">
      {pendingRequests.length > 0 ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Join requests</p>
                <p className="text-sm text-muted-foreground">
                  Approve students before they enter this classroom.
                </p>
              </div>
              <Badge variant="warning">{pendingRequests.length} pending</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-3xl border border-border bg-card/80 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initials(request.studentName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {request.studentName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {request.studentUsername
                          ? `@${request.studentUsername}`
                          : request.studentEmail}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyRequestId === request.id}
                      onClick={() => reviewRequest(request.id, "approved")}
                    >
                      <CheckCircle2 />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyRequestId === request.id}
                      onClick={() => reviewRequest(request.id, "rejected")}
                    >
                      <XCircle />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search roster, username, or email"
              className="pl-11"
            />
          </div>
          <Badge variant="secondary">
            {students.length} student{students.length === 1 ? "" : "s"}
          </Badge>
        </CardContent>
      </Card>

      {students.length === 0 ? (
        <EmptyState
          variant="messages"
          message="No students match this roster view."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => (
            <StudentDrawer
              key={student.id}
              data={data}
              classRecord={classRecord}
              student={student}
            />
          ))}
        </div>
      )}
    </div>
  );
}
