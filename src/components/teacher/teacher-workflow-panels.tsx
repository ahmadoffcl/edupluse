"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  BarChart3,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  FileUp,
  GraduationCap,
  Link2,
  Megaphone,
  MessageSquare,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Trash2,
  UploadCloud,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/content-blocks";
import {
  FileDownloadButton,
  FilePreviewButton,
} from "@/components/files/file-preview-dialog";
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
import { Progress } from "@/components/ui/progress";
import type {
  StudentPerformanceRow,
  TeacherClassOption,
  TeacherStudentOption,
  TeacherSubjectOption,
  TeacherSubmissionRow,
  TeacherWorkflowData,
} from "@/lib/dashboard/teacher-workflow";
import { formatDate } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-2xl border border-input bg-background/75 px-4 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";

const today = new Date().toISOString().slice(0, 10);
const TEACHER_LIST_PAGE_SIZE = 12;

function useRefreshMutation() {
  const router = useRouter();

  async function mutate(
    run: () => Promise<Response>,
    messages: { success: string; fallbackError: string },
  ) {
    const response = await run();
    const result = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;

    if (!response.ok || result?.ok === false) {
      throw new Error(result?.error ?? messages.fallbackError);
    }

    toast.success(messages.success);
    router.refresh();
  }

  return mutate;
}

function classOptionsLabel(classRecord: TeacherClassOption) {
  return `${classRecord.name}${classRecord.section ? ` - ${classRecord.section}` : ""}`;
}

function subjectsForClass(
  subjects: TeacherSubjectOption[],
  classId: string | null,
) {
  return subjects.filter(
    (subject) => !subject.classId || subject.classId === classId,
  );
}

function studentsForClass(
  students: TeacherStudentOption[],
  classId: string | null,
) {
  if (!classId) return students;
  return students.filter((student) => student.classIds.includes(classId));
}

function toIsoDateTime(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function bandLabel(row: StudentPerformanceRow) {
  return row.band.replace("_", " ");
}

function bandVariant(row: StudentPerformanceRow) {
  if (row.band === "high_momentum") return "success";
  if (row.band === "steady") return "info";
  if (row.band === "watch") return "warning";
  return "danger";
}

export function TeacherMetricStrip({ data }: { data: TeacherWorkflowData }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {data.metrics.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="p-3.5 sm:p-5">
            <p className="text-xs text-muted-foreground sm:text-sm">
              {metric.delta}
            </p>
            <div className="mt-2 flex items-end justify-between sm:mt-3">
              <p className="text-2xl font-semibold sm:text-3xl">
                {metric.value}
              </p>
              <Badge>{metric.label}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ClassBuilderPanel() {
  const mutate = useRefreshMutation();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    setBusy(true);

    try {
      await mutate(
        () =>
          fetch("/api/teacher/classes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
        {
          success: "Class created.",
          fallbackError: "Unable to create class.",
        },
      );
      event.currentTarget.reset();
    } catch (error) {
      toast.error("Class creation failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="size-5 text-primary" />
          Class setup
        </CardTitle>
        <CardDescription>
          Create a class, section, batch, and first subject in one workflow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <Input required name="name" placeholder="Class name" />
          <Input name="gradeLevel" placeholder="Grade or level" />
          <Input name="section" placeholder="Section" />
          <Input name="batch" placeholder="Batch" />
          <select
            className={selectClass}
            defaultValue="hybrid"
            name="deliveryMode"
          >
            <option value="physical">Physical</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <Input name="term" placeholder="Term" />
          <Input min={0} name="capacity" type="number" placeholder="Capacity" />
          <Input name="scheduleNote" placeholder="Timing or weekly schedule" />
          <Input name="subjectName" placeholder="First subject" />
          <Input name="subjectCode" placeholder="Subject code" />
          <Button className="md:col-span-2" disabled={busy} variant="premium">
            <Plus /> {busy ? "Creating..." : "Create class"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ClassEditForm({ classRecord }: { classRecord: TeacherClassOption }) {
  const mutate = useRefreshMutation();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    try {
      await mutate(
        () =>
          fetch(`/api/teacher/classes/${classRecord.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: String(form.get("name") ?? ""),
              gradeLevel: String(form.get("gradeLevel") ?? "") || null,
              section: String(form.get("section") ?? "") || null,
              batch: String(form.get("batch") ?? "") || null,
              deliveryMode: String(form.get("deliveryMode") ?? "hybrid"),
              term: String(form.get("term") ?? "") || null,
              capacity: String(form.get("capacity") ?? "")
                ? Number(form.get("capacity"))
                : null,
              scheduleNote: String(form.get("scheduleNote") ?? "") || null,
              subjectName: String(form.get("subjectName") ?? "") || null,
              subjectCode: String(form.get("subjectCode") ?? "") || null,
            }),
          }),
        {
          success: "Class updated.",
          fallbackError: "Unable to update class.",
        },
      );
    } catch (error) {
      toast.error("Class update failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function archiveClass() {
    setBusy(true);
    try {
      await mutate(
        () =>
          fetch(`/api/teacher/classes/${classRecord.id}`, {
            method: "DELETE",
          }),
        {
          success: "Class archived.",
          fallbackError: "Unable to archive class.",
        },
      );
    } catch (error) {
      toast.error("Archive failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="rounded-2xl border border-border bg-background/60 p-3 sm:rounded-3xl sm:p-4"
      onSubmit={submit}
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-semibold">{classRecord.name}</p>
          <p className="text-sm text-muted-foreground">
            {classRecord.section ?? "No section"} - {classRecord.deliveryMode}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={archiveClass}
        >
          <Archive /> Archive
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input required name="name" defaultValue={classRecord.name} />
        <Input
          name="gradeLevel"
          defaultValue={classRecord.gradeLevel ?? ""}
          placeholder="Grade or level"
        />
        <Input
          name="section"
          defaultValue={classRecord.section ?? ""}
          placeholder="Section"
        />
        <Input
          name="batch"
          defaultValue={classRecord.batch ?? ""}
          placeholder="Batch"
        />
        <select
          className={selectClass}
          name="deliveryMode"
          defaultValue={classRecord.deliveryMode}
        >
          <option value="physical">Physical</option>
          <option value="online">Online</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <Input
          name="term"
          defaultValue={classRecord.term ?? ""}
          placeholder="Term"
        />
        <Input
          min={0}
          name="capacity"
          type="number"
          defaultValue={classRecord.capacity ?? ""}
          placeholder="Capacity"
        />
        <Input
          name="scheduleNote"
          defaultValue={classRecord.scheduleNote ?? ""}
          placeholder="Timing"
        />
        <Input name="subjectName" placeholder="Update or add subject" />
        <Input name="subjectCode" placeholder="Subject code" />
      </div>
      <Button className="mt-4 w-full" disabled={busy}>
        <Edit3 /> Save class
      </Button>
    </form>
  );
}

export function ClassManagerPanel({ data }: { data: TeacherWorkflowData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="size-5 text-primary" />
          Class manager
        </CardTitle>
        <CardDescription>
          Edit real classes, sections, timings, delivery mode, and first
          subject.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.classes.length === 0 && (
          <EmptyState
            variant="schedule"
            message="No teacher-owned classes exist yet."
          />
        )}
        {data.classes.map((classRecord) => (
          <ClassEditForm key={classRecord.id} classRecord={classRecord} />
        ))}
      </CardContent>
    </Card>
  );
}

export function ResourceUploadPanel({ data }: { data: TeacherWorkflowData }) {
  const mutate = useRefreshMutation();
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  const subjectOptions = subjectsForClass(data.subjects, classId || null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    try {
      await mutate(
        () => fetch("/api/teacher/resources", { method: "POST", body: form }),
        {
          success: "Resource uploaded.",
          fallbackError: "Unable to upload resource.",
        },
      );
      event.currentTarget.reset();
    } catch (error) {
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="size-5 text-primary" />
          Resource upload
        </CardTitle>
        <CardDescription>
          Upload classroom-safe files, lesson notes, or resource links.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <Input required name="title" placeholder="Resource title" />
          <select
            className={selectClass}
            name="classId"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">All classes</option>
            {data.classes.map((classRecord) => (
              <option key={classRecord.id} value={classRecord.id}>
                {classOptionsLabel(classRecord)}
              </option>
            ))}
          </select>
          <select className={selectClass} name="subjectId" defaultValue="">
            <option value="">No subject</option>
            {subjectOptions.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <Input name="externalUrl" placeholder="Optional resource link" />
          <Input
            className="md:col-span-2"
            name="file"
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.webm,.mp4,.mov"
          />
          <Textarea
            className="md:col-span-2"
            name="body"
            placeholder="Optional lesson note or description"
          />
          <Button className="md:col-span-2" disabled={busy} variant="premium">
            <FileUp /> {busy ? "Saving..." : "Save resource"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ResourceRow({
  data,
  resourceId,
}: {
  data: TeacherWorkflowData;
  resourceId: string;
}) {
  const mutate = useRefreshMutation();
  const resource = data.resources.find((item) => item.id === resourceId);
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState(resource?.classId ?? "");
  const subjectOptions = subjectsForClass(data.subjects, classId || null);

  if (!resource) return null;
  const resolvedResource = resource;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    try {
      await mutate(
        () =>
          fetch(`/api/teacher/resources/${resolvedResource.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: String(form.get("title") ?? ""),
              classId: String(form.get("classId") ?? "") || null,
              subjectId: String(form.get("subjectId") ?? "") || null,
              body: String(form.get("body") ?? "") || null,
              externalUrl: String(form.get("externalUrl") ?? "") || null,
            }),
          }),
        {
          success: "Resource updated.",
          fallbackError: "Unable to update resource.",
        },
      );
    } catch (error) {
      toast.error("Resource update failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function archiveResource() {
    setBusy(true);
    try {
      await mutate(
        () =>
          fetch(`/api/teacher/resources/${resolvedResource.id}`, {
            method: "DELETE",
          }),
        {
          success: "Resource archived.",
          fallbackError: "Unable to archive resource.",
        },
      );
    } catch (error) {
      toast.error("Archive failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  const openUrl = resolvedResource.signedUrl ?? resolvedResource.externalUrl;

  return (
    <form
      className="rounded-3xl border border-border bg-background/60 p-4"
      onSubmit={submit}
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-semibold">{resolvedResource.title}</p>
          <p className="text-sm text-muted-foreground">
            {resolvedResource.className ?? "All classes"} -{" "}
            {resolvedResource.subjectName ?? resolvedResource.type}
          </p>
          {resolvedResource.originalFilename && (
            <p className="mt-1 text-xs text-muted-foreground">
              {resolvedResource.originalFilename}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {openUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={openUrl} target="_blank" rel="noreferrer">
                <ExternalLink /> Open
              </a>
            </Button>
          )}
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={busy}
            onClick={archiveResource}
          >
            <Trash2 /> Archive
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input required name="title" defaultValue={resolvedResource.title} />
        <select
          className={selectClass}
          name="classId"
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          <option value="">All classes</option>
          {data.classes.map((classRecord) => (
            <option key={classRecord.id} value={classRecord.id}>
              {classOptionsLabel(classRecord)}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          name="subjectId"
          defaultValue={resolvedResource.subjectId ?? ""}
        >
          <option value="">No subject</option>
          {subjectOptions.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        <Input
          name="externalUrl"
          defaultValue={resolvedResource.externalUrl ?? ""}
          placeholder="Resource link"
        />
        <Textarea
          className="md:col-span-2"
          name="body"
          defaultValue={resolvedResource.body ?? ""}
          placeholder="Note body"
        />
      </div>
      <Button className="mt-4 w-full" disabled={busy}>
        <Save /> Save resource
      </Button>
    </form>
  );
}

export function ResourceLibraryManagerPanel({
  data,
}: {
  data: TeacherWorkflowData;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="size-5 text-primary" />
          Resource library
        </CardTitle>
        <CardDescription>
          Preview, edit, and archive real classroom resources.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.resources.length === 0 && (
          <EmptyState
            variant="notes"
            message="No resources have been uploaded for your classes yet."
          />
        )}
        {data.resources.map((resource) => (
          <ResourceRow key={resource.id} data={data} resourceId={resource.id} />
        ))}
      </CardContent>
    </Card>
  );
}

export function AssignmentCreatorPanel({
  data,
}: {
  data: TeacherWorkflowData;
}) {
  const mutate = useRefreshMutation();
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  const subjectOptions = subjectsForClass(data.subjects, classId || null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      classId: String(form.get("classId") ?? ""),
      subjectId: String(form.get("subjectId") ?? "") || null,
      title: String(form.get("title") ?? ""),
      instructions: String(form.get("instructions") ?? "") || null,
      dueAt: toIsoDateTime(String(form.get("dueAt") ?? "")),
      points: Number(form.get("points") ?? 100),
      publish: form.get("publish") === "on",
    };
    setBusy(true);

    try {
      await mutate(
        () =>
          fetch("/api/teacher/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }),
        {
          success: "Assignment created.",
          fallbackError: "Unable to create assignment.",
        },
      );
      event.currentTarget.reset();
    } catch (error) {
      toast.error("Assignment failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-primary" />
          Assignment creator
        </CardTitle>
        <CardDescription>
          Publish class work with due dates, instructions, points, and subject
          mapping.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.classes.length === 0 ? (
          <EmptyState
            variant="assignments"
            message="Create a class before publishing assignments."
          />
        ) : (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
            <Input required name="title" placeholder="Assignment title" />
            <Input min={0} name="points" type="number" defaultValue={100} />
            <select
              required
              className={selectClass}
              name="classId"
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
            >
              {data.classes.map((classRecord) => (
                <option key={classRecord.id} value={classRecord.id}>
                  {classOptionsLabel(classRecord)}
                </option>
              ))}
            </select>
            <select className={selectClass} name="subjectId" defaultValue="">
              <option value="">No subject</option>
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <Input name="dueAt" type="datetime-local" />
            <label className="flex h-11 items-center gap-3 rounded-2xl border border-input bg-background/75 px-4 text-sm">
              <input name="publish" type="checkbox" defaultChecked />
              Publish now
            </label>
            <Textarea
              className="md:col-span-2"
              name="instructions"
              placeholder="Instructions"
            />
            <Button className="md:col-span-2" disabled={busy} variant="premium">
              <Send /> {busy ? "Publishing..." : "Create assignment"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function AssignmentManagerPanel({
  data,
}: {
  data: TeacherWorkflowData;
}) {
  const mutate = useRefreshMutation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(TEACHER_LIST_PAGE_SIZE);
  const filteredAssignments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data.assignmentRows;

    return data.assignmentRows.filter((assignment) =>
      [
        assignment.title,
        assignment.className,
        assignment.status,
        String(assignment.points),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [data.assignmentRows, query]);
  const visibleAssignments = filteredAssignments.slice(0, visibleCount);

  async function updateAssignment(
    assignmentId: string,
    body: Record<string, unknown>,
    success: string,
  ) {
    setBusyId(assignmentId);
    try {
      await mutate(
        () =>
          fetch(`/api/teacher/assignments/${assignmentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
        {
          success,
          fallbackError: "Unable to update assignment.",
        },
      );
    } catch (error) {
      toast.error("Assignment action failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function closeAssignment(assignmentId: string) {
    setBusyId(assignmentId);
    try {
      await mutate(
        () =>
          fetch(`/api/teacher/assignments/${assignmentId}`, {
            method: "DELETE",
          }),
        {
          success: "Assignment closed.",
          fallbackError: "Unable to close assignment.",
        },
      );
    } catch (error) {
      toast.error("Assignment close failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-primary" />
          Assignment manager
        </CardTitle>
        <CardDescription>
          Draft, publish, close, and edit real assignment records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.assignmentRows.length === 0 && (
          <EmptyState
            variant="assignments"
            message="No assignments exist for your classes yet."
          />
        )}
        {data.assignmentRows.length > 0 ? (
          <div className="sticky top-3 z-10 flex flex-col gap-3 rounded-2xl border border-border bg-card/90 p-3 backdrop-blur-xl lg:top-24 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search assignments, classes, or status"
                className="pl-11"
              />
            </div>
            <Badge variant="secondary">
              {filteredAssignments.length} assignment
              {filteredAssignments.length === 1 ? "" : "s"}
            </Badge>
          </div>
        ) : null}
        {data.assignmentRows.length > 0 && filteredAssignments.length === 0 ? (
          <EmptyState
            variant="assignments"
            message="No assignments match your search."
          />
        ) : null}
        {visibleAssignments.map((assignment) => (
          <form
            key={assignment.id}
            className="rounded-2xl border border-border bg-background/60 p-3 sm:rounded-3xl sm:p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              updateAssignment(
                assignment.id,
                {
                  title: String(form.get("title") ?? ""),
                  dueAt: toIsoDateTime(String(form.get("dueAt") ?? "")),
                  points: Number(form.get("points") ?? assignment.points),
                },
                "Assignment updated.",
              );
            }}
          >
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between sm:mb-4">
              <div>
                <p className="font-semibold">{assignment.title}</p>
                <p className="text-sm text-muted-foreground">
                  {assignment.className} - {assignment.status} -{" "}
                  {assignment.submittedCount}/{assignment.totalStudents}{" "}
                  submitted
                </p>
              </div>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                {assignment.status !== "published" && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={busyId === assignment.id}
                    onClick={() =>
                      updateAssignment(
                        assignment.id,
                        { status: "published" },
                        "Assignment published.",
                      )
                    }
                  >
                    <Send /> Publish
                  </Button>
                )}
                {assignment.status !== "closed" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={busyId === assignment.id}
                    onClick={() => closeAssignment(assignment.id)}
                  >
                    <Archive /> Close
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_190px_130px_auto]">
              <Input required name="title" defaultValue={assignment.title} />
              <Input
                name="dueAt"
                type="datetime-local"
                defaultValue={
                  assignment.dueAt ? assignment.dueAt.slice(0, 16) : ""
                }
              />
              <Input
                min={0}
                name="points"
                type="number"
                defaultValue={assignment.points}
              />
              <Button
                className="w-full md:w-auto"
                disabled={busyId === assignment.id}
              >
                <Save /> Save
              </Button>
            </div>
          </form>
        ))}
        {filteredAssignments.length > visibleAssignments.length ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setVisibleCount((count) => count + TEACHER_LIST_PAGE_SIZE)
              }
            >
              Load more assignments
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AttendanceRosterPanel({ data }: { data: TeacherWorkflowData }) {
  const mutate = useRefreshMutation();
  const [busy, setBusy] = useState(false);
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  const [attendedOn, setAttendedOn] = useState(today);
  const [records, setRecords] = useState<Record<string, string>>({});
  const roster = useMemo(
    () => studentsForClass(data.students, classId || null),
    [classId, data.students],
  );

  function setStatus(studentId: string, status: string) {
    setRecords((current) => ({ ...current, [studentId]: status }));
  }

  async function submit() {
    if (!classId || roster.length === 0) return;
    setBusy(true);

    try {
      await mutate(
        () =>
          fetch("/api/teacher/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classId,
              attendedOn,
              records: roster.map((student) => ({
                studentId: student.id,
                status: records[student.id] ?? "present",
              })),
            }),
          }),
        {
          success: "Attendance saved.",
          fallbackError: "Unable to save attendance.",
        },
      );
    } catch (error) {
      toast.error("Attendance failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-primary" />
          Attendance roster
        </CardTitle>
        <CardDescription>
          Mark present, absent, late, or excused for every enrolled student.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <select
            className={selectClass}
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            {data.classes.map((classRecord) => (
              <option key={classRecord.id} value={classRecord.id}>
                {classOptionsLabel(classRecord)}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={attendedOn}
            onChange={(event) => setAttendedOn(event.target.value)}
          />
        </div>

        {roster.length === 0 ? (
          <EmptyState
            variant="schedule"
            message="No enrolled students found for this class yet."
          />
        ) : (
          <div className="space-y-3">
            {roster.map((student) => {
              const current = records[student.id] ?? "present";

              return (
                <div
                  key={student.id}
                  className="rounded-3xl border border-border bg-background/60 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold">{student.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.username
                          ? `@${student.username}`
                          : student.email}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["present", "absent", "late", "excused"].map(
                        (status) => (
                          <Button
                            key={status}
                            size="sm"
                            type="button"
                            variant={current === status ? "default" : "outline"}
                            onClick={() => setStatus(student.id, status)}
                          >
                            {status}
                          </Button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <Button className="w-full" disabled={busy} onClick={submit}>
              <Save /> {busy ? "Saving..." : "Save attendance"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AttendanceHistoryPanel({
  data,
}: {
  data: TeacherWorkflowData;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-primary" />
          Attendance history
        </CardTitle>
        <CardDescription>
          Real attendance records across teacher-owned classes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.attendanceHistory.length === 0 && (
          <EmptyState
            variant="schedule"
            message="No attendance records have been saved yet."
          />
        )}
        {data.attendanceHistory.slice(0, 80).map((record) => (
          <div
            key={record.id}
            className="flex flex-col gap-3 rounded-3xl border border-border bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-semibold">{record.studentName}</p>
              <p className="text-sm text-muted-foreground">
                {record.studentUsername
                  ? `@${record.studentUsername}`
                  : record.className}{" "}
                - {record.className}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  record.status === "present"
                    ? "success"
                    : record.status === "absent"
                      ? "danger"
                      : "warning"
                }
              >
                {record.status}
              </Badge>
              <Badge variant="secondary">{formatDate(record.attendedOn)}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GradeSubmissionForm({
  data,
  submission,
}: {
  data: TeacherWorkflowData;
  submission: TeacherSubmissionRow;
}) {
  const mutate = useRefreshMutation();
  const [busy, setBusy] = useState(false);
  const classRecord = data.classes.find(
    (item) => item.id === submission.classId,
  );
  const performance = data.performance.find(
    (item) => item.profileId === submission.studentId,
  );
  const submittedFile = submission.signedUrl
    ? {
        name:
          submission.originalFilename ?? `${submission.assignmentTitle} file`,
        mimeType: submission.mimeType,
        signedUrl: submission.signedUrl,
        downloadName:
          submission.originalFilename ??
          `${submission.assignmentTitle}-submission`,
        source: "submission" as const,
      }
    : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    try {
      await mutate(
        () =>
          fetch(`/api/teacher/submissions/${submission.id}/grade`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              score: Number(form.get("score") ?? 0),
              feedback: String(form.get("feedback") ?? "") || null,
              status: "graded",
            }),
          }),
        {
          success: "Grade saved.",
          fallbackError: "Unable to save grade.",
        },
      );
    } catch (error) {
      toast.error("Grading failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="overflow-hidden rounded-3xl border border-border bg-background/60"
      onSubmit={submit}
    >
      <div className="border-b border-border bg-card/80 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{submission.assignmentTitle}</p>
              <Badge
                variant={submission.status === "graded" ? "success" : "warning"}
              >
                {submission.status === "graded" ? "graded" : "needs review"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {submission.studentName} - {classRecord?.name ?? "Class"} -{" "}
              {submission.submittedAt
                ? formatDate(submission.submittedAt)
                : "recent submission"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Score", submission.score ?? "-"],
              ["Perf", performance?.performanceScore ?? 0],
              ["Missing", performance?.missingCount ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-muted px-3 py-2">
                <p className="text-sm font-semibold">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button asChild size="sm" variant="outline">
            <Link
              href={`/teacher/assignments/${submission.assignmentId}/checks/${submission.id}`}
            >
              <BarChart3 />
              View checks report
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {submission.content ? (
            <div className="rounded-2xl border border-border bg-background/70 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Student note
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {submission.content}
              </p>
            </div>
          ) : null}

          {submittedFile ? (
            <div className="rounded-2xl border border-border bg-background/70 p-3">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {submittedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted file
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <FilePreviewButton file={submittedFile} />
                <FileDownloadButton file={submittedFile} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background/45 p-3 text-sm text-muted-foreground">
              No file was attached to this submission.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Input
            required
            min={0}
            max={1000}
            name="score"
            type="number"
            defaultValue={submission.score ?? 0}
            placeholder="Score"
          />
          <Textarea
            name="feedback"
            placeholder="Detailed feedback for the student"
            defaultValue={submission.feedback ?? ""}
          />
          <Button className="w-full" disabled={busy} type="submit">
            <Save /> {busy ? "Saving..." : "Save grade and feedback"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function GradingQueuePanel({ data }: { data: TeacherWorkflowData }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "review" | "graded">(
    "review",
  );
  const [visibleCount, setVisibleCount] = useState(TEACHER_LIST_PAGE_SIZE);
  const gradingStats = {
    review: data.submissions.filter((item) => item.status !== "graded").length,
    graded: data.submissions.filter((item) => item.status === "graded").length,
    files: data.submissions.filter((item) => item.signedUrl).length,
  };
  const filteredSubmissions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const statusMatched = data.submissions.filter((submission) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "graded") return submission.status === "graded";
      return submission.status !== "graded";
    });
    if (!normalized) return statusMatched;

    return statusMatched.filter((submission) =>
      [submission.assignmentTitle, submission.studentName, submission.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [data.submissions, query, statusFilter]);
  const visibleSubmissions = filteredSubmissions.slice(0, visibleCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grading studio</CardTitle>
        <CardDescription>
          Review submitted files, read student notes, return scores, and send
          useful feedback from one queue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Needs review", gradingStats.review, "warning"],
            ["Graded", gradingStats.graded, "success"],
            ["With files", gradingStats.files, "info"],
          ].map(([label, value, variant]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-border bg-background/60 p-3"
            >
              <p className="text-xl font-semibold">{value}</p>
              <Badge variant={variant as "warning" | "success" | "info"}>
                {label}
              </Badge>
            </div>
          ))}
        </div>
        {data.submissions.length === 0 && (
          <EmptyState
            variant="assignments"
            message="No submissions are waiting in the grading queue."
          />
        )}
        {data.submissions.length > 0 ? (
          <div className="sticky top-3 z-10 flex flex-col gap-3 rounded-2xl border border-border bg-card/90 p-3 backdrop-blur-xl lg:top-24 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search submissions, students, or status"
                className="pl-11"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {[
                ["review", "Needs review"],
                ["graded", "Graded"],
                ["all", "All"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={statusFilter === value ? "default" : "outline"}
                  onClick={() =>
                    setStatusFilter(value as "all" | "review" | "graded")
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <Badge variant="secondary">
              {filteredSubmissions.length} submission
              {filteredSubmissions.length === 1 ? "" : "s"}
            </Badge>
          </div>
        ) : null}
        {data.submissions.length > 0 && filteredSubmissions.length === 0 ? (
          <EmptyState
            variant="assignments"
            message="No submissions match your search."
          />
        ) : null}
        {visibleSubmissions.map((submission) => (
          <GradeSubmissionForm
            key={submission.id}
            data={data}
            submission={submission}
          />
        ))}
        {filteredSubmissions.length > visibleSubmissions.length ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setVisibleCount((count) => count + TEACHER_LIST_PAGE_SIZE)
              }
            >
              Load more submissions
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CommunicationComposerPanel({
  data,
}: {
  data: TeacherWorkflowData;
}) {
  const mutate = useRefreshMutation();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{
    inviteUrl: string;
    code: string;
  } | null>(null);

  async function submitAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyAction("announcement");

    try {
      await mutate(
        () =>
          fetch("/api/teacher/announcements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classId: String(form.get("classId") ?? "") || null,
              title: String(form.get("title") ?? ""),
              body: String(form.get("body") ?? ""),
            }),
          }),
        {
          success: "Announcement published.",
          fallbackError: "Unable to publish announcement.",
        },
      );
      event.currentTarget.reset();
    } catch (error) {
      toast.error("Announcement failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyAction("event");

    try {
      await mutate(
        () =>
          fetch("/api/teacher/calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classId: String(form.get("classId") ?? "") || null,
              title: String(form.get("title") ?? ""),
              kind: String(form.get("kind") ?? "event"),
              startsAt: toIsoDateTime(String(form.get("startsAt") ?? "")),
              endsAt: toIsoDateTime(String(form.get("endsAt") ?? "")),
            }),
          }),
        {
          success: "Calendar event created.",
          fallbackError: "Unable to create calendar event.",
        },
      );
      event.currentTarget.reset();
    } catch (error) {
      toast.error("Calendar event failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyAction("message");

    try {
      await mutate(
        () =>
          fetch("/api/teacher/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              classId: String(form.get("classId") ?? ""),
              body: String(form.get("body") ?? ""),
              title: String(form.get("title") ?? "") || null,
            }),
          }),
        {
          success: "Class message sent.",
          fallbackError: "Unable to send class message.",
        },
      );
      event.currentTarget.reset();
    } catch (error) {
      toast.error("Message failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyAction("invite");

    try {
      const response = await fetch("/api/teacher/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: String(form.get("classId") ?? ""),
          expiresInDays: Number(form.get("expiresInDays") ?? 7),
          maxUses: Number(form.get("maxUses") ?? 30),
          section: String(form.get("section") ?? "") || null,
          personalMessage: String(form.get("personalMessage") ?? "") || null,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        invite?: { inviteUrl: string; code: string };
      };

      if (!response.ok || !result.ok || !result.invite) {
        throw new Error(result.error ?? "Unable to create invite.");
      }

      setCreatedInvite(result.invite);
      toast.success("Class invite created.");
    } catch (error) {
      toast.error("Invite failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-5 text-primary" />
            Announcement
          </CardTitle>
          <CardDescription>
            Notify a class and create student notification records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submitAnnouncement}>
            <select className={selectClass} name="classId" defaultValue="">
              <option value="">All classes</option>
              {data.classes.map((classRecord) => (
                <option key={classRecord.id} value={classRecord.id}>
                  {classOptionsLabel(classRecord)}
                </option>
              ))}
            </select>
            <Input required name="title" placeholder="Announcement title" />
            <Textarea required name="body" placeholder="Message" />
            <Button
              className="w-full"
              disabled={busyAction === "announcement"}
              variant="premium"
            >
              <Megaphone />
              {busyAction === "announcement" ? "Publishing..." : "Publish"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="size-5 text-primary" />
            Calendar event
          </CardTitle>
          <CardDescription>
            Schedule exams, live classes, events, assignments, or holidays.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submitEvent}>
            <Input
              required
              className="md:col-span-2"
              name="title"
              placeholder="Event title"
            />
            <select className={selectClass} name="classId" defaultValue="">
              <option value="">All classes</option>
              {data.classes.map((classRecord) => (
                <option key={classRecord.id} value={classRecord.id}>
                  {classOptionsLabel(classRecord)}
                </option>
              ))}
            </select>
            <select className={selectClass} name="kind" defaultValue="event">
              <option value="live">Live class</option>
              <option value="exam">Exam</option>
              <option value="assignment">Assignment</option>
              <option value="event">Event</option>
              <option value="holiday">Holiday</option>
            </select>
            <Input required name="startsAt" type="datetime-local" />
            <Input name="endsAt" type="datetime-local" />
            <Button className="md:col-span-2" disabled={busyAction === "event"}>
              <CalendarPlus />
              {busyAction === "event" ? "Scheduling..." : "Schedule"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            Class message
          </CardTitle>
          <CardDescription>
            Send a real class-channel message to enrolled students.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submitMessage}>
            <Input name="title" placeholder="Thread title override" />
            <select className={selectClass} name="classId" required>
              {data.classes.map((classRecord) => (
                <option key={classRecord.id} value={classRecord.id}>
                  {classOptionsLabel(classRecord)}
                </option>
              ))}
            </select>
            <Textarea required name="body" placeholder="Message" />
            <Button
              className="w-full"
              disabled={busyAction === "message"}
              variant="premium"
            >
              <MessageSquare />
              {busyAction === "message" ? "Sending..." : "Send message"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Class invite code
          </CardTitle>
          <CardDescription>
            Generate a student invite link and code for a specific class.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submitInvite}>
            <select className={selectClass} name="classId" required>
              {data.classes.map((classRecord) => (
                <option key={classRecord.id} value={classRecord.id}>
                  {classOptionsLabel(classRecord)}
                </option>
              ))}
            </select>
            <Input
              min={1}
              max={60}
              type="number"
              name="expiresInDays"
              defaultValue={7}
            />
            <Input
              min={1}
              max={200}
              type="number"
              name="maxUses"
              defaultValue={30}
            />
            <Input name="section" placeholder="Section" />
            <Textarea
              className="md:col-span-2"
              name="personalMessage"
              placeholder="Optional welcome message"
            />
            <Button
              className="md:col-span-2"
              disabled={busyAction === "invite"}
            >
              <Link2 />
              {busyAction === "invite" ? "Generating..." : "Generate invite"}
            </Button>
          </form>
          {createdInvite && (
            <div className="mt-4 rounded-3xl border border-primary/25 bg-primary/10 p-4">
              <p className="font-semibold">Copy this invite now</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(createdInvite.inviteUrl);
                    toast.success("Invite link copied.");
                  }}
                >
                  <Copy /> Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(createdInvite.code);
                    toast.success("Invite code copied.");
                  }}
                >
                  <Copy /> {createdInvite.code}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CommunicationHistoryPanel({
  data,
}: {
  data: TeacherWorkflowData;
}) {
  const mutate = useRefreshMutation();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function updateRecord(
    url: string,
    method: "PATCH" | "DELETE",
    body: Record<string, unknown> | null,
    success: string,
  ) {
    setBusyId(url);
    try {
      await mutate(
        () =>
          fetch(url, {
            method,
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
          }),
        {
          success,
          fallbackError: "Unable to update communication record.",
        },
      );
    } catch (error) {
      toast.error("Communication action failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
          <CardDescription>Published teacher announcements.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.announcements.length === 0 && (
            <EmptyState
              variant="messages"
              message="No announcements have been published yet."
            />
          )}
          {data.announcements.map((announcement) => (
            <form
              key={announcement.id}
              className="rounded-3xl border border-border bg-background/60 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                updateRecord(
                  `/api/teacher/announcements/${announcement.id}`,
                  "PATCH",
                  {
                    title: String(form.get("title") ?? ""),
                    body: String(form.get("body") ?? ""),
                    classId: announcement.classId,
                  },
                  "Announcement updated.",
                );
              }}
            >
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {announcement.className ?? "All classes"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    busyId === `/api/teacher/announcements/${announcement.id}`
                  }
                  onClick={() =>
                    updateRecord(
                      `/api/teacher/announcements/${announcement.id}`,
                      "DELETE",
                      null,
                      "Announcement archived.",
                    )
                  }
                >
                  <Trash2 /> Archive
                </Button>
              </div>
              <Input required name="title" defaultValue={announcement.title} />
              <Textarea
                required
                className="mt-3"
                name="body"
                defaultValue={announcement.body}
              />
              <Button className="mt-3 w-full">
                <Save /> Save announcement
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Upcoming teacher-created events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.calendarEvents.length === 0 && (
            <EmptyState
              variant="schedule"
              message="No calendar events are scheduled yet."
            />
          )}
          {data.calendarEvents.map((event) => (
            <form
              key={event.id}
              className="rounded-3xl border border-border bg-background/60 p-4"
              onSubmit={(submitEvent) => {
                submitEvent.preventDefault();
                const form = new FormData(submitEvent.currentTarget);
                updateRecord(
                  `/api/teacher/calendar/${event.id}`,
                  "PATCH",
                  {
                    title: String(form.get("title") ?? ""),
                    kind: String(form.get("kind") ?? "event"),
                    startsAt: toIsoDateTime(String(form.get("startsAt") ?? "")),
                    endsAt: toIsoDateTime(String(form.get("endsAt") ?? "")),
                    classId: event.classId,
                  },
                  "Calendar event updated.",
                );
              }}
            >
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <p className="text-sm text-muted-foreground">
                  {event.className ?? "All classes"}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === `/api/teacher/calendar/${event.id}`}
                  onClick={() =>
                    updateRecord(
                      `/api/teacher/calendar/${event.id}`,
                      "DELETE",
                      null,
                      "Calendar event archived.",
                    )
                  }
                >
                  <Trash2 /> Archive
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input required name="title" defaultValue={event.title} />
                <select
                  className={selectClass}
                  name="kind"
                  defaultValue={event.kind}
                >
                  <option value="live">Live class</option>
                  <option value="exam">Exam</option>
                  <option value="assignment">Assignment</option>
                  <option value="event">Event</option>
                  <option value="holiday">Holiday</option>
                </select>
                <Input
                  required
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={event.startsAt.slice(0, 16)}
                />
                <Input
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={event.endsAt?.slice(0, 16) ?? ""}
                />
              </div>
              <Button className="mt-3 w-full">
                <Save /> Save event
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function StudentPerformancePanel({
  rows,
}: {
  rows: StudentPerformanceRow[];
}) {
  const atRisk = rows.filter((row) => row.band === "at_risk");
  const highMomentum = rows.filter((row) => row.band === "high_momentum");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" />
          Student performance
        </CardTitle>
        <CardDescription>
          Engagement-heavy index from submissions, scores, XP, missing work, and
          momentum.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["At risk", atRisk.length, "Needs intervention"],
            ["High momentum", highMomentum.length, "Strong activity"],
            ["Tracked", rows.length, "Real enrolled students"],
          ].map(([label, value, meta]) => (
            <div
              key={label}
              className="rounded-3xl border border-border bg-background/60 p-4"
            >
              <p className="text-sm text-muted-foreground">{meta}</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-2xl font-semibold">{value}</p>
                <Badge variant="secondary">{label}</Badge>
              </div>
            </div>
          ))}
        </div>

        {rows.length === 0 && (
          <EmptyState
            variant="activity"
            message="No performance data exists yet. Add students, assignments, and grading to activate insights."
          />
        )}

        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.profileId}
              className="rounded-3xl border border-border bg-background/60 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{row.name}</p>
                    <Badge variant={bandVariant(row)}>{bandLabel(row)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.username ? `@${row.username}` : "Username pending"} -
                    submissions {row.submittedPercent}%
                  </p>
                </div>
                <p className="text-3xl font-semibold">{row.performanceScore}</p>
              </div>
              <Progress className="mt-4" value={row.performanceScore} />
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-4">
                <span>Score avg: {row.averageScore}%</span>
                <span>XP: {row.xp}</span>
                <span>Missing: {row.missingCount}</span>
                <span>Late: {row.lateCount}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TeacherSettingsForm({ data }: { data: TeacherWorkflowData }) {
  const mutate = useRefreshMutation();
  const [busy, setBusy] = useState(false);
  const profile = data.profile;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    try {
      await mutate(
        () =>
          fetch("/api/teacher/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              displayName: String(form.get("displayName") ?? ""),
              username: String(form.get("username") ?? "") || null,
              bio: String(form.get("bio") ?? "") || null,
              tagline: String(form.get("tagline") ?? "") || null,
              officeHours: String(form.get("officeHours") ?? "") || null,
              gradingTargetHours: Number(form.get("gradingTargetHours") ?? 48),
              aiAssistance: form.get("aiAssistance") === "on",
            }),
          }),
        {
          success: "Teacher settings saved.",
          fallbackError: "Unable to save teacher settings.",
        },
      );
    } catch (error) {
      toast.error("Settings failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="size-5 text-primary" />
          Teacher profile and workflow settings
        </CardTitle>
        <CardDescription>
          Public teacher identity, office hours, grading target, and AI
          assistance preference.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!profile ? (
          <EmptyState
            variant="messages"
            message="Your teacher profile is not ready yet."
          />
        ) : (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
            <Input
              required
              name="displayName"
              defaultValue={profile.displayName}
              placeholder="Display name"
            />
            <Input
              name="username"
              defaultValue={profile.username ?? ""}
              placeholder="@username"
            />
            <Input
              name="tagline"
              defaultValue={profile.tagline}
              placeholder="Teacher tagline"
            />
            <Input
              name="officeHours"
              defaultValue={profile.officeHours}
              placeholder="Office hours"
            />
            <Input
              min={1}
              max={720}
              name="gradingTargetHours"
              type="number"
              defaultValue={profile.gradingTargetHours}
              placeholder="Grading target hours"
            />
            <label className="flex h-11 items-center gap-3 rounded-2xl border border-input bg-background/75 px-4 text-sm">
              <input
                name="aiAssistance"
                type="checkbox"
                defaultChecked={profile.aiAssistance}
              />
              AI assistance enabled
            </label>
            <Textarea
              className="md:col-span-2"
              name="bio"
              defaultValue={profile.bio ?? ""}
              placeholder="Short teacher introduction"
            />
            <Button className="md:col-span-2" disabled={busy} variant="premium">
              <Save /> {busy ? "Saving..." : "Save settings"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
