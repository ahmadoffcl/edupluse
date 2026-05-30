"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
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
  smartLearningEnabled,
}: {
  data: TeacherWorkflowData;
  classRecord: TeacherClassOption;
  student: TeacherStudentOption;
  smartLearningEnabled: boolean;
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
  const missionSignals = data.missionSignals.filter(
    (signal) =>
      signal.profileId === student.id &&
      (!signal.classId || signal.classId === classRecord.id),
  );
  const missionSignal =
    missionSignals.length > 0
      ? missionSignals.reduce(
          (summary, signal) => ({
            openCount: summary.openCount + signal.openCount,
            completedCount: summary.completedCount + signal.completedCount,
            dismissedCount: summary.dismissedCount + signal.dismissedCount,
            urgentCount: summary.urgentCount + signal.urgentCount,
            missedCount: summary.missedCount + signal.missedCount,
            latestTitle: summary.latestTitle ?? signal.latestTitle,
            lastActionAt:
              !summary.lastActionAt ||
              (signal.lastActionAt &&
                new Date(signal.lastActionAt).getTime() >
                  new Date(summary.lastActionAt).getTime())
                ? signal.lastActionAt
                : summary.lastActionAt,
            lastActionLabel: signal.lastActionLabel ?? summary.lastActionLabel,
            suggestedFollowUp:
              signal.urgentCount > 0 ||
              (!summary.urgentCount && signal.openCount > summary.openCount)
                ? signal.suggestedFollowUp
                : summary.suggestedFollowUp,
          }),
          {
            openCount: 0,
            completedCount: 0,
            dismissedCount: 0,
            urgentCount: 0,
            missedCount: 0,
            latestTitle: null as string | null,
            lastActionAt: null as string | null,
            lastActionLabel: null as string | null,
            suggestedFollowUp: "No mission risk is visible yet.",
          },
        )
      : null;

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

            {smartLearningEnabled ? (
              <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-card to-card p-4 dark:bg-card">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-amber-500" />
                    <div>
                      <p className="font-semibold">Student focus signal</p>
                      <p className="text-xs text-muted-foreground">
                        What this learner may need next, from real missions.
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      missionSignal?.urgentCount
                        ? "danger"
                        : missionSignal?.openCount
                          ? "warning"
                          : "success"
                    }
                  >
                    {missionSignal?.openCount ?? 0} open
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Finished", missionSignal?.completedCount ?? 0],
                    ["Urgent", missionSignal?.urgentCount ?? 0],
                    ["Missed", missionSignal?.missedCount ?? 0],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-border/70 bg-background/72 p-3"
                    >
                      <p className="text-lg font-semibold">{value}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 rounded-2xl border border-border bg-background/72 p-3 text-sm text-muted-foreground">
                  {missionSignal?.latestTitle
                    ? `Current focus: ${missionSignal.latestTitle}`
                    : "No active mission activity for this class yet."}
                </p>
                {missionSignal?.lastActionLabel ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Last action: {missionSignal.lastActionLabel}
                    {missionSignal.lastActionAt
                      ? ` - ${formatDate(missionSignal.lastActionAt)}`
                      : ""}
                  </p>
                ) : null}
                <p className="mt-2 rounded-2xl bg-amber-500/10 p-3 text-sm font-medium dark:bg-white/5">
                  {missionSignal?.suggestedFollowUp ??
                    "No mission risk is visible yet."}
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
  smartLearningEnabled = false,
}: {
  data: TeacherWorkflowData;
  classRecord: TeacherClassOption;
  smartLearningEnabled?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [busyTeacherId, setBusyTeacherId] = useState<string | null>(null);
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
  const classTeachers = data.classTeachers.filter(
    (teacher) => teacher.classId === classRecord.id,
  );
  const pendingTeachers = classTeachers.filter(
    (teacher) => teacher.status === "pending",
  );
  const activeTeachers = classTeachers.filter(
    (teacher) => teacher.status === "active",
  );

  async function reviewTeacher(
    teacherId: string,
    action: "approve" | "reject",
  ) {
    setBusyTeacherId(teacherId);
    try {
      const response = await fetch(
        `/api/teacher/classes/${classRecord.id}/teachers/${teacherId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to review co-teacher.");
      }

      toast.success(
        action === "approve"
          ? "Co-teacher approved."
          : "Co-teacher request declined.",
      );
      router.refresh();
    } catch (error) {
      toast.error("Co-teacher action failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyTeacherId(null);
    }
  }

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
      {classTeachers.length > 0 ? (
        <Card className="border-indigo-400/20 bg-indigo-500/5">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <UserCheck className="size-4 text-primary" />
                  Co-teachers
                </p>
                <p className="text-sm text-muted-foreground">
                  Teacher invites join this exact class after owner approval.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{activeTeachers.length} active</Badge>
                {pendingTeachers.length ? (
                  <Badge variant="warning">
                    {pendingTeachers.length} waiting
                  </Badge>
                ) : null}
              </div>
            </div>

            {pendingTeachers.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  Waiting for approval
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {pendingTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="rounded-3xl border border-border bg-card/86 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-full bg-amber-500/12 text-xs font-bold text-amber-600">
                          {initials(teacher.teacherName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {teacher.teacherName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {teacher.teacherUsername
                              ? `@${teacher.teacherUsername}`
                              : teacher.teacherEmail}
                          </span>
                        </span>
                        <Badge variant="warning">Waiting</Badge>
                      </div>
                      {classRecord.canApproveTeachers ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyTeacherId === teacher.teacherId}
                            onClick={() =>
                              reviewTeacher(teacher.teacherId, "approve")
                            }
                          >
                            <CheckCircle2 />
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyTeacherId === teacher.teacherId}
                            onClick={() =>
                              reviewTeacher(teacher.teacherId, "reject")
                            }
                          >
                            <XCircle />
                            Decline
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTeachers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeTeachers.map((teacher) => (
                  <span
                    key={teacher.id}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-2 text-sm"
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {initials(teacher.teacherName)}
                    </span>
                    <span className="truncate">{teacher.teacherName}</span>
                    <Badge variant="success">Approved</Badge>
                  </span>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
              smartLearningEnabled={smartLearningEnabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
