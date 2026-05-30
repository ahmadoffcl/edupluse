"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Edit3,
  FileSearch,
  FileText,
  ImageIcon,
  Link2,
  Megaphone,
  Plus,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserMinus,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ClassroomCard as PremiumClassroomCard } from "@/components/classroom/classroom-card";
import { EmptyState } from "@/components/dashboard/content-blocks";
import {
  FileDownloadButton,
  FilePreviewButton,
} from "@/components/files/file-preview-dialog";
import { TeacherStudentHub } from "@/components/teacher/teacher-student-hub";
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
import type {
  TeacherClassOption,
  TeacherWorkflowData,
} from "@/lib/dashboard/teacher-workflow";
import { cn, formatDate, initials } from "@/lib/utils";

type ClassFormState = {
  name: string;
  description: string;
  bannerUrl: string;
};

const emptyClassForm: ClassFormState = {
  name: "",
  description: "",
  bannerUrl: "",
};

function classStudents(data: TeacherWorkflowData, classId: string) {
  return data.students.filter((student) => student.classIds.includes(classId));
}

function classAssignments(data: TeacherWorkflowData, classId: string) {
  return data.assignmentRows.filter(
    (assignment) => assignment.classId === classId,
  );
}

function classResources(data: TeacherWorkflowData, classId: string) {
  return data.resources.filter((resource) => resource.classId === classId);
}

function classAnnouncements(data: TeacherWorkflowData, classId: string) {
  return data.announcements.filter(
    (announcement) => announcement.classId === classId,
  );
}

function nextTeacherDeadline(data: TeacherWorkflowData, classId: string) {
  return classAssignments(data, classId)
    .filter((assignment) => assignment.status !== "closed" && assignment.dueAt)
    .sort(
      (a, b) =>
        new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime(),
    )[0]?.dueAt;
}

function ClassInterventionPanel({
  data,
  classRecord,
  enabled,
}: {
  data: TeacherWorkflowData;
  classRecord: TeacherClassOption;
  enabled: boolean;
}) {
  if (!enabled) return null;

  const studentsById = new Map(
    data.students.map((student) => [student.id, student]),
  );
  const signals = data.missionSignals
    .filter(
      (signal) =>
        signal.classId === classRecord.id &&
        (signal.openCount > 0 ||
          signal.urgentCount > 0 ||
          signal.missedCount > 0),
    )
    .sort(
      (a, b) =>
        b.urgentCount - a.urgentCount ||
        b.missedCount - a.missedCount ||
        b.openCount - a.openCount,
    )
    .slice(0, 4);

  if (signals.length === 0) return null;

  return (
    <Card className="border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-card to-card dark:bg-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-amber-500" />
              Students needing help today
            </p>
            <p className="text-sm text-muted-foreground">
              Smart Learning turns real missing work, deadlines, and feedback
              into teacher follow-up signals.
            </p>
          </div>
          <Badge variant="warning">{signals.length} signal(s)</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {signals.map((signal) => {
            const student = studentsById.get(signal.profileId);
            return (
              <button
                key={`${signal.profileId}-${signal.classId ?? "all"}`}
                type="button"
                onClick={() => {
                  document
                    .querySelector<HTMLButtonElement>(
                      `[data-teacher-tab="people"]`,
                    )
                    ?.click();
                }}
                className="rounded-2xl border border-border bg-card/80 p-3 text-left transition hover:-translate-y-0.5 hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {student?.username
                        ? `@${student.username}`
                        : (student?.name ?? "Student")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {signal.suggestedFollowUp}
                    </p>
                  </div>
                  <AlertTriangle className="size-4 text-amber-500" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="warning">{signal.openCount} open</Badge>
                  {signal.urgentCount ? (
                    <Badge variant="danger">{signal.urgentCount} urgent</Badge>
                  ) : null}
                  {signal.missedCount ? (
                    <Badge variant="danger">{signal.missedCount} missed</Badge>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function displayStudent(
  student: TeacherWorkflowData["availableStudents"][number],
) {
  return student.username ? `@${student.username}` : student.name;
}

function Banner({
  classRecord,
  previewName,
}: {
  classRecord?: TeacherClassOption;
  previewName?: string;
}) {
  const bannerUrl = classRecord?.bannerUrl;

  return (
    <div className="relative min-h-36 overflow-hidden rounded-[2rem] bg-[#111827] p-6 text-white shadow-[0_22px_80px_-45px_rgba(0,0,0,0.9)]">
      {bannerUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{ backgroundImage: `url(${bannerUrl})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(96,165,250,0.45),transparent_36%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.38),transparent_34%),linear-gradient(135deg,#020617,#111827_42%,#1e1b4b)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-end gap-2">
        <Badge className="w-fit border-white/20 bg-white/12 text-white">
          Classroom
        </Badge>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
          {classRecord?.name ?? previewName}
        </h1>
        {classRecord?.description ? (
          <p className="max-w-2xl text-sm text-white/78">
            {classRecord.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ClassCreationWizard({
  students,
  compact = false,
}: {
  students: TeacherWorkflowData["availableStudents"];
  compact?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ClassFormState>(emptyClassForm);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const filteredStudents = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return students;
    return students.filter((student) =>
      [student.name, student.username, student.email]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search)),
    );
  }, [query, students]);

  function toggleStudent(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Class name is required.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          bannerUrl: form.bannerUrl || "",
          studentIds: Array.from(selected),
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to create class.");
      }

      toast.success("Class created.");
      setForm(emptyClassForm);
      setSelected(new Set());
      setQuery("");
      setStep(1);
      router.push("/teacher");
      router.refresh();
    } catch (error) {
      toast.error("Class creation failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[2rem] border-border/80 bg-card/88",
        !compact && "mx-auto max-w-5xl",
      )}
    >
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Create a class</CardTitle>
            <CardDescription>
              Add the class details, then choose the students who belong in it.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span
              className={cn(
                "rounded-full px-3 py-1",
                step === 1 ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              Details
            </span>
            <ChevronRight className="size-4" />
            <span
              className={cn(
                "rounded-full px-3 py-1",
                step === 2 ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              Students
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 md:p-6">
        {step === 1 ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Class name"
              />
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Description"
              />
              <div className="relative">
                <ImageIcon className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
                <Input
                  value={form.bannerUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      bannerUrl: event.target.value,
                    }))
                  }
                  className="pl-11"
                  placeholder="Banner image URL"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!form.name.trim()}
                >
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
            <Banner previewName={form.name || "New class"} />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative md:w-96">
                <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-11"
                  placeholder="Search students"
                />
              </div>
              <Badge variant="info">{selected.size} selected</Badge>
            </div>

            {students.length === 0 ? (
              <EmptyState
                variant="messages"
                message="No student accounts exist yet. Create students from Admin ID Maker, then add them to classes."
              />
            ) : (
              <div className="grid max-h-[420px] gap-3 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {filteredStudents.map((student) => {
                  const active = selected.has(student.id);
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleStudent(student.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background/70",
                      )}
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold">
                        {initials(student.name || "Student")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {student.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {displayStudent(student)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-full border",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {active ? <Check className="size-4" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={busy}
              >
                <ArrowLeft /> Back
              </Button>
              <Button type="button" onClick={submit} disabled={busy}>
                <Plus /> {busy ? "Creating..." : "Create class"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddStudentsPanel({ data }: { data: TeacherWorkflowData }) {
  const router = useRouter();
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const students = useMemo(() => {
    const search = query.trim().toLowerCase();
    return data.availableStudents
      .filter((student) => !student.classIds.includes(classId))
      .filter((student) => {
        if (!search) return true;
        return [student.name, student.username, student.email]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(search));
      });
  }, [classId, data.availableStudents, query]);

  function toggleStudent(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!classId || selected.size === 0) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: Array.from(selected) }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to add students.");
      }

      toast.success("Students added.");
      setSelected(new Set());
      router.refresh();
    } catch (error) {
      showFormError("Students could not be added", error);
    } finally {
      setBusy(false);
    }
  }

  if (data.classes.length === 0) {
    return (
      <EmptyState
        variant="assignments"
        message="Create a class first, then add students to it."
      />
    );
  }

  return (
    <div className="space-y-4">
      <select
        className="flex h-11 w-full rounded-2xl border border-input bg-background/75 px-4 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        value={classId}
        onChange={(event) => {
          setClassId(event.target.value);
          setSelected(new Set());
        }}
      >
        {data.classes.map((classRecord) => (
          <option key={classRecord.id} value={classRecord.id}>
            {classRecord.name}
          </option>
        ))}
      </select>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-11"
          placeholder="Search students"
        />
      </div>
      <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
        {students.length === 0 ? (
          <EmptyState
            variant="messages"
            message="No available students found for this class."
          />
        ) : (
          students.map((student) => {
            const active = selected.has(student.id);
            return (
              <button
                key={student.id}
                type="button"
                onClick={() => toggleStudent(student.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-3xl border p-3 text-left transition",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/60 hover:bg-muted",
                )}
              >
                <span className="grid size-10 place-items-center rounded-full bg-muted text-xs font-bold">
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
                {active ? <Check className="size-4 text-primary" /> : null}
              </button>
            );
          })
        )}
      </div>
      <Button
        className="w-full"
        disabled={!classId || selected.size === 0 || busy}
        onClick={submit}
      >
        <UsersRound /> {busy ? "Adding..." : `Add ${selected.size} student(s)`}
      </Button>
    </div>
  );
}

function TeacherFloatingActions({ data }: { data: TeacherWorkflowData }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "create" | "students">("menu");

  return (
    <>
      {open ? (
        <div className="fixed bottom-24 right-4 z-50 max-h-[min(720px,calc(100vh-8rem))] w-[min(94vw,560px)] overflow-auto rounded-[2rem] border border-border bg-card/96 p-4 shadow-2xl backdrop-blur-2xl md:right-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {mode === "create"
                  ? "Create classroom"
                  : mode === "students"
                    ? "Add students"
                    : "Quick add"}
              </p>
              <p className="text-xs text-muted-foreground">
                {mode === "menu"
                  ? "Choose what you want to add."
                  : "Save changes when ready."}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                setMode("menu");
              }}
            >
              Close
            </Button>
          </div>

          {mode === "menu" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("create")}
                className="rounded-3xl border border-border bg-background/70 p-5 text-left transition hover:-translate-y-0.5 hover:bg-muted"
              >
                <BookOpen className="mb-4 size-6 text-primary" />
                <p className="font-semibold">Create classroom</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a class and select students.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode("students")}
                className="rounded-3xl border border-border bg-background/70 p-5 text-left transition hover:-translate-y-0.5 hover:bg-muted"
              >
                <UsersRound className="mb-4 size-6 text-primary" />
                <p className="font-semibold">Add students</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enroll students into an existing class.
                </p>
              </button>
            </div>
          ) : null}

          {mode === "create" ? (
            <ClassCreationWizard students={data.availableStudents} compact />
          ) : null}

          {mode === "students" ? <AddStudentsPanel data={data} /> : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-24 right-5 z-50 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_20px_45px_-20px_var(--primary)] transition hover:-translate-y-1 md:right-8"
        aria-label="Add"
      >
        <Plus className="size-6" />
      </button>
    </>
  );
}

function TeacherHomeStats({ data }: { data: TeacherWorkflowData }) {
  const stats = [
    {
      label: "Classes",
      value: data.classes.length,
      icon: BookOpen,
      tone: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    },
    {
      label: "Students",
      value: data.students.length,
      icon: UsersRound,
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    },
    {
      label: "Classwork",
      value: data.assignmentRows.length + data.resources.length,
      icon: ClipboardList,
      tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {stats.map(({ label, value, icon: Icon, tone }) => (
        <div
          key={label}
          className="min-w-0 rounded-2xl border border-border bg-card/85 p-2.5 text-center sm:flex sm:items-center sm:gap-3 sm:rounded-[1.75rem] sm:p-4 sm:text-left"
        >
          <span
            className={cn(
              "mx-auto grid size-9 place-items-center rounded-2xl sm:mx-0 sm:size-11",
              tone,
            )}
          >
            <Icon className="size-4 sm:size-5" />
          </span>
          <span className="mt-1 block min-w-0 sm:mt-0">
            <span className="block text-lg font-semibold leading-5 sm:text-2xl">
              {value}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground sm:text-sm">
              {label}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function ClassDetailRow({
  data,
  classRecord,
}: {
  data: TeacherWorkflowData;
  classRecord: TeacherClassOption;
}) {
  const students = classStudents(data, classRecord.id);
  const assignments = classAssignments(data, classRecord.id);
  const resources = classResources(data, classRecord.id);
  const announcements = classAnnouncements(data, classRecord.id);
  const visibleStudents = students.slice(0, 8);
  const remainingStudents = Math.max(
    0,
    students.length - visibleStudents.length,
  );
  const capacity = classRecord.capacity
    ? `${students.length}/${classRecord.capacity}`
    : `${students.length}`;
  const summaryStats = [
    { label: "Students", value: capacity, icon: UsersRound },
    { label: "Assignments", value: assignments.length, icon: ClipboardList },
    { label: "Materials", value: resources.length, icon: FileText },
    { label: "Posts", value: announcements.length, icon: Megaphone },
  ];

  return (
    <div className="grid gap-4 rounded-[2rem] border border-border bg-card/88 p-4 shadow-sm lg:grid-cols-[240px_1fr]">
      <Link
        href={`/teacher/classes/${classRecord.id}`}
        className="relative min-h-44 overflow-hidden rounded-[1.5rem] bg-[#111827] p-5 text-white"
      >
        {classRecord.bannerUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: `url(${classRecord.bannerUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(96,165,250,0.5),transparent_35%),radial-gradient(circle_at_85%_18%,rgba(168,85,247,0.38),transparent_32%),linear-gradient(135deg,#020617,#111827,#1e1b4b)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <Badge className="w-fit border-white/20 bg-white/12 text-white">
            {classRecord.section || "Class"}
          </Badge>
          <div>
            <p className="text-xl font-semibold tracking-tight">
              {classRecord.name}
            </p>
            <p className="text-xs text-white/72">Open classroom</p>
          </div>
        </div>
      </Link>

      <div className="space-y-4 p-1">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {classRecord.name}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {classRecord.description || "No description added yet."}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/teacher/classes/${classRecord.id}`}>
              Open <ChevronRight />
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/teacher/classes/${classRecord.id}?tab=stream`}>
              <Megaphone /> Add post
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/teacher/classes/${classRecord.id}?tab=classwork`}>
              <ClipboardList /> Add assignment
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {summaryStats.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="min-w-0 rounded-2xl border border-border bg-background/55 p-2 text-center sm:p-3 sm:text-left"
            >
              <Icon className="mx-auto mb-1 size-4 text-primary sm:mx-0 sm:mb-3" />
              <p className="text-base font-semibold leading-5 sm:text-lg">
                {value}
              </p>
              <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
                {label}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Students enrolled</p>
            <Badge variant="secondary">{students.length}</Badge>
          </div>
          {students.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-background/45 p-4 text-sm text-muted-foreground">
              No students added yet.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleStudents.map((student) => (
                <span
                  key={student.id}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-2 text-sm"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-muted text-[10px] font-bold">
                    {initials(student.name)}
                  </span>
                  {displayStudent(student)}
                </span>
              ))}
              {remainingStudents > 0 ? (
                <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-2 text-sm font-semibold">
                  +{remainingStudents} more
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TeacherClassroomHome({
  data,
}: {
  data: TeacherWorkflowData;
  smartLearningEnabled?: boolean;
}) {
  const hasClasses = data.classes.length > 0;

  if (!hasClasses) {
    return (
      <div className="space-y-8">
        <PendingTeacherApprovalNotice data={data} />
        <section className="space-y-3">
          <Badge variant="info">Teacher workspace</Badge>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
            Start by creating your first class.
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Your classes, students, assignments, posts, and materials will stay
            organized from here.
          </p>
        </section>
        <EmptyState
          variant="assignments"
          message="Tap the floating plus button to create a classroom."
        />
        <TeacherFloatingActions data={data} />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <PendingTeacherApprovalNotice data={data} />
      <section className="overflow-hidden rounded-[2rem] border border-border bg-card/86 p-4 shadow-[var(--shadow-glass)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <Badge variant="info">Teacher workspace</Badge>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
              Your classrooms
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Open a class to post assignments, share updates, and manage
              students without clutter.
            </p>
          </div>
          <TeacherHomeStats data={data} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Classes</h2>
          <Badge variant="secondary">{data.classes.length}</Badge>
        </div>
        <div className="-mx-2 flex snap-x gap-4 overflow-x-auto px-2 pb-3">
          {data.classes.map((classRecord) => (
            <PremiumClassroomCard
              key={classRecord.id}
              className="min-w-[280px] snap-start sm:min-w-[320px] xl:min-w-[340px]"
              href={`/teacher/classes/${classRecord.id}`}
              name={classRecord.name}
              description={classRecord.description}
              bannerUrl={classRecord.bannerUrl}
              teacherName="You"
              section={classRecord.section}
              term={classRecord.term}
              roleLabel="Teacher"
              nextDeadline={nextTeacherDeadline(data, classRecord.id)}
              stats={[
                {
                  label: "Students",
                  value: classStudents(data, classRecord.id).length,
                  icon: "people",
                },
                {
                  label: "Work",
                  value: classAssignments(data, classRecord.id).length,
                  icon: "assignments",
                },
                {
                  label: "Files",
                  value: classResources(data, classRecord.id).length,
                  icon: "materials",
                },
              ]}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Class details
          </h2>
          <Badge variant="info">{data.students.length} students</Badge>
        </div>
        <div className="space-y-4">
          {data.classes.map((classRecord) => (
            <ClassDetailRow
              key={classRecord.id}
              data={data}
              classRecord={classRecord}
            />
          ))}
        </div>
      </section>
      <TeacherFloatingActions data={data} />
    </div>
  );
}

function showFormError(title: string, error: unknown) {
  toast.error(title, {
    description: error instanceof Error ? error.message : "Try again.",
  });
}

function PendingTeacherApprovalNotice({ data }: { data: TeacherWorkflowData }) {
  if (data.pendingTeacherInvites.length === 0) return null;

  return (
    <Card className="border-amber-400/25 bg-amber-500/8">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <Clock3 className="size-4 text-amber-500" />
              Waiting for class owner approval
            </p>
            <p className="text-sm text-muted-foreground">
              You accepted a co-teacher invite. The class will appear here after
              the owner approves your access.
            </p>
          </div>
          <Badge variant="warning">
            {data.pendingTeacherInvites.length} pending
          </Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.pendingTeacherInvites.map((invite) => (
            <div
              key={invite.id}
              className="rounded-2xl border border-border bg-card/80 p-3"
            >
              <p className="font-semibold">{invite.className}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Requested{" "}
                {invite.requestedAt ? formatDate(invite.requestedAt) : "today"}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TeacherClassroomDetail({
  data,
  classRecord,
  initialTab = "stream",
  smartLearningEnabled = false,
}: {
  data: TeacherWorkflowData;
  classRecord: TeacherClassOption;
  initialTab?: "stream" | "classwork" | "materials" | "people";
  smartLearningEnabled?: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<
    "stream" | "classwork" | "materials" | "people"
  >(initialTab);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const students = classStudents(data, classRecord.id);
  const assignments = classAssignments(data, classRecord.id);
  const resources = classResources(data, classRecord.id);
  const announcements = classAnnouncements(data, classRecord.id);
  const tabs = [
    { value: "stream", label: "Stream", icon: Megaphone },
    { value: "classwork", label: "Classwork", icon: ClipboardList },
    { value: "materials", label: "Materials", icon: FileText },
    { value: "people", label: "People", icon: UsersRound },
  ] as const;
  const summaryStats = [
    ["Students", students.length, UsersRound, "people" as const],
    ["Assignments", assignments.length, ClipboardList, "classwork" as const],
    ["Materials", resources.length, FileText, "materials" as const],
    ["Posts", announcements.length, Megaphone, "stream" as const],
  ] as const;

  async function parseResponse(response: Response, fallbackError: string) {
    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (!response.ok || result?.ok === false) {
      throw new Error(result?.error ?? fallbackError);
    }
  }

  async function submitAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("announcement");
    try {
      await parseResponse(
        await fetch("/api/teacher/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId: classRecord.id,
            title: String(form.get("title") ?? ""),
            body: String(form.get("body") ?? ""),
          }),
        }),
        "Unable to post announcement.",
      );
      toast.success("Announcement posted.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      showFormError("Announcement failed", error);
    } finally {
      setBusy(null);
    }
  }

  async function updateAnnouncement(
    event: FormEvent<HTMLFormElement>,
    announcementId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const busyId = `announcement:${announcementId}:save`;
    setBusy(busyId);
    try {
      await parseResponse(
        await fetch(`/api/teacher/announcements/${announcementId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classId: classRecord.id,
            title: String(form.get("title") ?? ""),
            body: String(form.get("body") ?? ""),
          }),
        }),
        "Unable to update post.",
      );
      toast.success("Post updated.");
      setEditingPostId(null);
      router.refresh();
    } catch (error) {
      showFormError("Post update failed", error);
    } finally {
      setBusy(null);
    }
  }

  async function deleteAnnouncement(announcementId: string) {
    const confirmed = window.confirm("Delete this class post?");
    if (!confirmed) return;

    const busyId = `announcement:${announcementId}:delete`;
    setBusy(busyId);
    try {
      await parseResponse(
        await fetch(`/api/teacher/announcements/${announcementId}`, {
          method: "DELETE",
        }),
        "Unable to delete post.",
      );
      toast.success("Post deleted.");
      router.refresh();
    } catch (error) {
      showFormError("Post delete failed", error);
    } finally {
      setBusy(null);
    }
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dueDate = String(form.get("dueDate") ?? "");
    const dueTime = String(form.get("dueTime") ?? "");
    const dueAt = dueDate
      ? new Date(`${dueDate}T${dueTime || "23:59"}`).toISOString()
      : "";
    form.set("classId", classRecord.id);
    form.set("dueAt", dueAt);
    form.set("publish", "true");
    setBusy("assignment");
    try {
      await parseResponse(
        await fetch("/api/teacher/assignments", {
          method: "POST",
          body: form,
        }),
        "Unable to create assignment.",
      );
      toast.success("Assignment posted.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      showFormError("Assignment failed", error);
    } finally {
      setBusy(null);
    }
  }

  async function submitResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("classId", classRecord.id);
    setBusy("resource");
    try {
      await parseResponse(
        await fetch("/api/teacher/resources", {
          method: "POST",
          body: form,
        }),
        "Unable to add material.",
      );
      toast.success("Material added.");
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      showFormError("Material failed", error);
    } finally {
      setBusy(null);
    }
  }

  async function leaveClass() {
    const confirmed = window.confirm(
      "Remove yourself from this class? You can be invited again later.",
    );
    if (!confirmed) return;

    setBusy("leave-class");
    try {
      await parseResponse(
        await fetch(`/api/teacher/classes/${classRecord.id}/teachers/self`, {
          method: "DELETE",
        }),
        "Unable to remove you from this class.",
      );
      toast.success("You were removed from this class.");
      router.push("/teacher");
      router.refresh();
    } catch (error) {
      showFormError("Leave class failed", error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild size="sm" variant="ghost" className="px-0">
          <Link href="/teacher">
            <ArrowLeft /> Back to classrooms
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={leaveClass}
          disabled={busy === "leave-class"}
        >
          <UserMinus />
          {busy === "leave-class" ? "Removing..." : "Leave class"}
        </Button>
      </div>
      <Banner classRecord={classRecord} />

      <div className="grid grid-cols-4 gap-2">
        {summaryStats.map(([label, value, Icon, targetTab]) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(targetTab)}
            className="min-w-0 rounded-2xl border border-border bg-card/78 p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:bg-muted sm:p-3 sm:text-left"
          >
            <Icon className="mx-auto mb-1 size-4 text-primary sm:mx-0 sm:mb-2" />
            <p className="text-base font-semibold leading-5 sm:text-xl">
              {value}
            </p>
            <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
              {label}
            </p>
          </button>
        ))}
      </div>

      <ClassInterventionPanel
        data={data}
        classRecord={classRecord}
        enabled={smartLearningEnabled}
      />

      <div className="glass-panel sticky top-3 z-20 flex gap-1 overflow-x-auto rounded-full p-1 lg:top-24">
        {tabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            data-teacher-tab={value}
            onClick={() => setTab(value)}
            className={cn(
              "inline-flex min-w-fit items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-4 sm:text-sm",
              tab === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.main
          key={tab}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          {tab === "stream" ? (
            <section className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Post to class</CardTitle>
                  <CardDescription>
                    Share an update with students in this classroom.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={submitAnnouncement}>
                    <Input name="title" placeholder="Title" required />
                    <Textarea name="body" placeholder="Announcement" required />
                    <Button disabled={busy === "announcement"}>
                      <Send /> {busy === "announcement" ? "Posting..." : "Post"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {announcements.length === 0 ? (
                <EmptyState
                  variant="activity"
                  message="No posts yet. Share the first class update when you are ready."
                />
              ) : (
                announcements.map((announcement) => (
                  <Card key={announcement.id}>
                    <CardContent className="p-5">
                      {editingPostId === announcement.id ? (
                        <form
                          className="space-y-3"
                          onSubmit={(event) =>
                            updateAnnouncement(event, announcement.id)
                          }
                        >
                          <Input
                            required
                            name="title"
                            defaultValue={announcement.title}
                          />
                          <Textarea
                            required
                            name="body"
                            defaultValue={announcement.body}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              disabled={
                                busy === `announcement:${announcement.id}:save`
                              }
                            >
                              <Save /> Save post
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setEditingPostId(null)}
                            >
                              <X /> Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">
                                {announcement.title}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {announcement.authorName
                                  ? `${announcement.authorName} - `
                                  : ""}
                                {announcement.publishedAt
                                  ? formatDate(announcement.publishedAt)
                                  : "Posted"}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setEditingPostId(announcement.id)
                                }
                                aria-label="Edit post"
                              >
                                <Edit3 className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                disabled={
                                  busy ===
                                  `announcement:${announcement.id}:delete`
                                }
                                onClick={() =>
                                  void deleteAnnouncement(announcement.id)
                                }
                                aria-label="Delete post"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground">
                            {announcement.body}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </section>
          ) : null}

          {tab === "classwork" ? (
            <section className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Create assignment</CardTitle>
                  <CardDescription>
                    Students in this class will see it after you post.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-3 md:grid-cols-2"
                    onSubmit={submitAssignment}
                  >
                    <Input
                      className="md:col-span-2"
                      name="title"
                      placeholder="Assignment title"
                      required
                    />
                    <Textarea
                      className="md:col-span-2"
                      name="instructions"
                      placeholder="Instructions"
                    />
                    <Input name="dueDate" type="date" />
                    <Input name="dueTime" type="time" />
                    <Input
                      name="points"
                      type="number"
                      min={0}
                      defaultValue={100}
                    />
                    <Input
                      className="md:col-span-2"
                      name="files"
                      type="file"
                      multiple
                    />
                    <Button
                      className="md:col-span-2"
                      disabled={busy === "assignment"}
                    >
                      <ClipboardList />{" "}
                      {busy === "assignment" ? "Posting..." : "Post assignment"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assignments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {assignments.length === 0 ? (
                    <EmptyState
                      variant="assignments"
                      message="No assignments posted in this class yet."
                    />
                  ) : (
                    assignments.map((assignment) => {
                      const assignmentSubmissions = data.submissions.filter(
                        (submission) =>
                          submission.assignmentId === assignment.id,
                      );
                      return (
                        <div
                          key={assignment.id}
                          className="rounded-3xl border border-border bg-background/60 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">
                                {assignment.title}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {assignment.submittedCount}/
                                {assignment.totalStudents} submitted
                              </p>
                              {assignment.dueAt ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Due {formatDate(assignment.dueAt)}
                                </p>
                              ) : null}
                            </div>
                            <Badge>{assignment.status}</Badge>
                          </div>
                          {assignment.attachments.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
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
                                    className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/80 p-2"
                                  >
                                    <span className="text-sm font-medium">
                                      {attachment.name}
                                    </span>
                                    <FilePreviewButton file={file} />
                                    <FileDownloadButton file={file} />
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                          {assignmentSubmissions.length > 0 ? (
                            <div className="mt-3 rounded-2xl border border-border bg-card/70 p-3">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                Checks reports
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {assignmentSubmissions
                                  .slice(0, 4)
                                  .map((submission) => (
                                    <Button
                                      key={submission.id}
                                      asChild
                                      size="sm"
                                      variant="outline"
                                    >
                                      <Link
                                        href={`/teacher/assignments/${assignment.id}/checks/${submission.id}`}
                                      >
                                        <FileSearch />
                                        {submission.studentName}
                                      </Link>
                                    </Button>
                                  ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {tab === "materials" ? (
            <section className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Add material</CardTitle>
                  <CardDescription>
                    Upload a file, add a link, or write a short note.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-3 md:grid-cols-2"
                    onSubmit={submitResource}
                  >
                    <Input
                      className="md:col-span-2"
                      name="title"
                      placeholder="Material title"
                      required
                    />
                    <Input name="externalUrl" placeholder="Link" />
                    <Input name="file" type="file" />
                    <Textarea
                      className="md:col-span-2"
                      name="body"
                      placeholder="Note"
                    />
                    <Button
                      className="md:col-span-2"
                      disabled={busy === "resource"}
                    >
                      <FileText />{" "}
                      {busy === "resource" ? "Adding..." : "Add material"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {resources.length === 0 ? (
                  <EmptyState
                    variant="notes"
                    message="No materials have been added to this class yet."
                  />
                ) : (
                  resources.map((resource) => {
                    const file = resource.signedUrl
                      ? {
                          name:
                            resource.originalFilename ??
                            resource.title ??
                            "Class material",
                          mimeType: resource.mimeType,
                          signedUrl: resource.signedUrl,
                          downloadName:
                            resource.originalFilename ?? resource.title,
                          source: "resource" as const,
                        }
                      : null;
                    return (
                      <Card key={resource.id}>
                        <CardContent className="space-y-3 p-4">
                          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                            <FileText className="size-5" />
                          </span>
                          <div>
                            <p className="font-semibold">{resource.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {resource.originalFilename ?? resource.type}
                            </p>
                          </div>
                          {resource.body ? (
                            <p className="line-clamp-3 rounded-2xl border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                              {resource.body}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            {file ? (
                              <>
                                <FilePreviewButton file={file} />
                                <FileDownloadButton file={file} />
                              </>
                            ) : resource.externalUrl ? (
                              <Button asChild size="sm" variant="outline">
                                <a
                                  href={resource.externalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Link2 className="size-4" /> Open link
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}

          {tab === "people" ? (
            <TeacherStudentHub
              data={data}
              classRecord={classRecord}
              smartLearningEnabled={smartLearningEnabled}
            />
          ) : null}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
