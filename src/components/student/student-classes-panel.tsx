"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  Megaphone,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { ClassroomCard } from "@/components/classroom/classroom-card";
import { EmptyState } from "@/components/dashboard/content-blocks";
import {
  FileDownloadButton,
  FilePreviewButton,
} from "@/components/files/file-preview-dialog";
import { StudentAssignmentsPanel } from "@/components/student/student-assignments-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { StudentClassRow } from "@/lib/dashboard/server-data";
import { cn, initials } from "@/lib/utils";

const CLASS_PAGE_SIZE = 12;
const CLASS_DETAIL_PAGE_SIZE = 12;

function nextClassDeadline(classRecord: StudentClassRow) {
  return classRecord.assignments
    .filter(
      (assignment) =>
        assignment.status === "pending" || assignment.status === "late",
    )
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )[0]?.dueDate;
}

export function StudentClassesPanel({
  classes,
  compact = false,
}: {
  classes: StudentClassRow[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(
    compact ? 8 : CLASS_PAGE_SIZE,
  );
  const enrolledClasses = useMemo(
    () => classes.filter((item) => item.enrollmentStatus === "enrolled"),
    [classes],
  );
  const panelClasses = compact
    ? enrolledClasses.length > 0
      ? enrolledClasses
      : classes
    : classes;

  const filteredClasses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return panelClasses;

    return panelClasses.filter((classRecord) =>
      [
        classRecord.name,
        classRecord.section,
        classRecord.term,
        classRecord.description,
        classRecord.teacherName,
        classRecord.suggestedReason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [panelClasses, query]);
  const visibleClasses = compact
    ? filteredClasses.slice(0, 8)
    : filteredClasses.slice(0, visibleCount);
  const statusCounts = {
    enrolled: panelClasses.filter(
      (item) => item.enrollmentStatus === "enrolled",
    ).length,
    pending: panelClasses.filter((item) => item.enrollmentStatus === "pending")
      .length,
    suggested: panelClasses.filter(
      (item) => item.enrollmentStatus === "suggested",
    ).length,
    available: panelClasses.filter(
      (item) => item.enrollmentStatus === "available",
    ).length,
  };

  async function requestJoin(classId: string) {
    setRequestingId(classId);
    try {
      const response = await fetch(
        `/api/student/classes/${classId}/join-request`,
        { method: "POST" },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to request this class.");
      }

      toast.success("Class request sent", {
        description: "Your teacher can approve it from the class roster.",
      });
      router.refresh();
    } catch (error) {
      toast.error("Request failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setRequestingId(null);
    }
  }

  if (panelClasses.length === 0) {
    return (
      <EmptyState
        variant="notes"
        message={
          compact
            ? "No classrooms yet. Open Classes to discover available sections."
            : "No classes are available yet. Ask a teacher or admin to create the first classroom."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">My classes</h2>
          <p className="text-sm text-muted-foreground">
            {compact
              ? "Your active classrooms and next sections."
              : "Enrolled, suggested, and available classes in your institute."}
          </p>
        </div>
        {compact ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/student/classes">
              View all <ChevronRight />
            </Link>
          </Button>
        ) : null}
      </div>

      {!compact ? (
        <Card className="sticky top-3 z-10 border-border/70 bg-card/88 backdrop-blur-xl lg:top-24">
          <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search classes, teachers, sections, or descriptions"
                className="pl-11"
              />
            </div>
            <Badge variant="secondary">
              {filteredClasses.length} class
              {filteredClasses.length === 1 ? "" : "es"}
            </Badge>
          </CardContent>
        </Card>
      ) : null}

      {!compact ? (
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            ["Enrolled", statusCounts.enrolled, "default"],
            ["Suggested", statusCounts.suggested, "success"],
            ["Pending", statusCounts.pending, "warning"],
            ["Available", statusCounts.available, "secondary"],
          ].map(([label, value, variant]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-border bg-card/70 p-3 shadow-sm"
            >
              <p className="text-xl font-semibold">{value}</p>
              <Badge
                variant={
                  variant as "default" | "success" | "warning" | "secondary"
                }
              >
                {label}
              </Badge>
            </div>
          ))}
        </div>
      ) : null}

      {filteredClasses.length === 0 ? (
        <EmptyState variant="notes" message="No classes match your search." />
      ) : null}

      <div
        className={
          compact
            ? "-mx-2 flex snap-x gap-4 overflow-x-auto px-2 pb-3"
            : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        }
      >
        {visibleClasses.map((classRecord) => {
          const enrolled = classRecord.enrollmentStatus === "enrolled";
          const pending = classRecord.enrollmentStatus === "pending";
          const suggested = classRecord.enrollmentStatus === "suggested";

          return (
            <ClassroomCard
              key={classRecord.id}
              href={enrolled ? `/student/classes/${classRecord.id}` : undefined}
              name={classRecord.name}
              description={
                enrolled
                  ? classRecord.description
                  : (classRecord.suggestedReason ??
                    classRecord.description ??
                    "Request access to join this classroom.")
              }
              bannerUrl={classRecord.bannerUrl}
              teacherName={classRecord.teacherName}
              section={classRecord.section}
              term={classRecord.term}
              roleLabel={
                enrolled
                  ? "Enrolled"
                  : pending
                    ? "Pending"
                    : suggested
                      ? "Suggested"
                      : "Available"
              }
              nextDeadline={enrolled ? nextClassDeadline(classRecord) : null}
              stats={
                enrolled
                  ? [
                      {
                        label: "Work",
                        value: classRecord.assignmentCount,
                        icon: "assignments",
                      },
                      {
                        label: "Files",
                        value: classRecord.resourceCount,
                        icon: "materials",
                      },
                      {
                        label: "Posts",
                        value: classRecord.announcementCount,
                        icon: "posts",
                      },
                    ]
                  : [
                      {
                        label: "Status",
                        value: pending ? "Wait" : "Open",
                        icon: "people",
                      },
                      {
                        label: "Section",
                        value: classRecord.section ?? "-",
                        icon: "posts",
                      },
                      {
                        label: "Seats",
                        value: classRecord.capacity ?? "-",
                        icon: "people",
                      },
                    ]
              }
              action={
                !enrolled ? (
                  <Button
                    type="button"
                    className="w-full"
                    variant={pending ? "outline" : "default"}
                    disabled={pending || requestingId === classRecord.id}
                    onClick={() => requestJoin(classRecord.id)}
                  >
                    {pending ? <Clock3 /> : <UsersRound />}
                    {pending
                      ? "Waiting for approval"
                      : requestingId === classRecord.id
                        ? "Sending..."
                        : "Request to join"}
                  </Button>
                ) : null
              }
              className={
                compact
                  ? "min-w-[285px] snap-start sm:min-w-[330px]"
                  : undefined
              }
            />
          );
        })}
      </div>

      {!compact && filteredClasses.length > visibleClasses.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((count) => count + CLASS_PAGE_SIZE)}
          >
            Load more classes
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ClassHero({ classRecord }: { classRecord: StudentClassRow }) {
  return (
    <div className="relative min-h-40 overflow-hidden rounded-[1.5rem] bg-[#111827] p-5 text-white shadow-[0_22px_80px_-45px_rgba(0,0,0,0.9)] md:min-h-48 md:p-6">
      {classRecord.bannerUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-65"
          style={{ backgroundImage: `url(${classRecord.bannerUrl})` }}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(96,165,250,0.48),transparent_34%),radial-gradient(circle_at_85%_16%,rgba(168,85,247,0.4),transparent_32%),linear-gradient(135deg,#020617,#111827,#1e1b4b)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      <div className="relative z-10 flex min-h-32 flex-col justify-between md:min-h-36">
        <div className="flex flex-wrap gap-2">
          <Badge className="w-fit border-white/20 bg-white/12 text-white">
            Enrolled
          </Badge>
          {classRecord.teacherName ? (
            <Badge className="w-fit border-white/20 bg-white/12 text-white">
              {classRecord.teacherName}
            </Badge>
          ) : null}
        </div>
        <div>
          <h1 className="max-w-3xl text-2xl font-semibold tracking-tight md:text-4xl">
            {classRecord.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/76">
            {classRecord.description || classRecord.section || "Classroom"}
          </p>
        </div>
      </div>
    </div>
  );
}

function MaterialsPanel({ classRecord }: { classRecord: StudentClassRow }) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(CLASS_DETAIL_PAGE_SIZE);
  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return classRecord.resources;

    return classRecord.resources.filter((resource) =>
      [
        resource.title,
        resource.subject,
        resource.body,
        resource.originalFilename,
        resource.externalUrl,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [classRecord.resources, query]);
  const visibleResources = filteredResources.slice(0, visibleCount);

  if (classRecord.resources.length === 0) {
    return (
      <EmptyState
        variant="notes"
        message="No materials have been shared in this class yet."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="sticky top-[4.75rem] z-10 border-border/70 bg-card/88 backdrop-blur-xl lg:top-40">
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files, links, and notes"
              className="pl-11"
            />
          </div>
          <Badge variant="secondary">
            {filteredResources.length} material
            {filteredResources.length === 1 ? "" : "s"}
          </Badge>
        </CardContent>
      </Card>

      {filteredResources.length === 0 ? (
        <EmptyState variant="notes" message="No materials match your search." />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {visibleResources.map((resource) => {
          const href = resource.fileUrl || resource.externalUrl;
          const previewFile = resource.fileUrl
            ? {
                name:
                  resource.originalFilename ?? resource.title ?? "Class file",
                mimeType: resource.mimeType,
                signedUrl: resource.fileUrl,
                downloadName: resource.originalFilename ?? resource.title,
                source: "resource" as const,
              }
            : null;
          return (
            <Card key={resource.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <FileText className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{resource.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {resource.originalFilename || resource.subject}
                    </p>
                  </div>
                </div>
                {resource.body ? (
                  <p className="rounded-2xl border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                    {resource.body}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {previewFile ? (
                    <>
                      <FilePreviewButton file={previewFile} />
                      <FileDownloadButton file={previewFile} />
                    </>
                  ) : href ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={href} target="_blank" rel="noreferrer">
                        Open link <ExternalLink />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredResources.length > visibleResources.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setVisibleCount((count) => count + CLASS_DETAIL_PAGE_SIZE)
            }
          >
            Load more materials
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StreamPanel({ classRecord }: { classRecord: StudentClassRow }) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(CLASS_DETAIL_PAGE_SIZE);
  const filteredPosts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return classRecord.announcements;

    return classRecord.announcements.filter((post) =>
      [post.title, post.body]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [classRecord.announcements, query]);
  const visiblePosts = filteredPosts.slice(0, visibleCount);

  if (classRecord.announcements.length === 0) {
    return (
      <EmptyState
        variant="activity"
        message="No posts have been shared in this class yet."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="sticky top-[4.75rem] z-10 border-border/70 bg-card/88 backdrop-blur-xl lg:top-40">
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search class posts"
              className="pl-11"
            />
          </div>
          <Badge variant="secondary">
            {filteredPosts.length} post{filteredPosts.length === 1 ? "" : "s"}
          </Badge>
        </CardContent>
      </Card>

      {filteredPosts.length === 0 ? (
        <EmptyState variant="activity" message="No posts match your search." />
      ) : null}

      {visiblePosts.map((post) => (
        <Card key={post.id}>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                <Megaphone className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{post.title}</p>
                {post.publishedAt ? (
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(post.publishedAt)}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-muted-foreground">
                  {post.body}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {filteredPosts.length > visiblePosts.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setVisibleCount((count) => count + CLASS_DETAIL_PAGE_SIZE)
            }
          >
            Load more posts
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PeoplePanel({ classRecord }: { classRecord: StudentClassRow }) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(CLASS_DETAIL_PAGE_SIZE);
  const filteredClassmates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return classRecord.classmates;

    return classRecord.classmates.filter((student) =>
      [student.name, student.username, student.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [classRecord.classmates, query]);
  const visibleClassmates = filteredClassmates.slice(0, visibleCount);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-5 text-primary" />
            Teacher
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-3xl border border-border bg-background/60 p-4">
            <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {initials(classRecord.teacherName || "Teacher")}
            </span>
            <div>
              <p className="font-semibold">
                {classRecord.teacherName || "Teacher"}
              </p>
              <p className="text-sm text-muted-foreground">Class owner</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="size-5 text-primary" />
            Classmates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {classRecord.classmates.length > 0 ? (
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search classmates"
                  className="pl-11"
                />
              </div>
              <Badge variant="secondary">
                {filteredClassmates.length} student
                {filteredClassmates.length === 1 ? "" : "s"}
              </Badge>
            </div>
          ) : null}

          {classRecord.classmates.length === 0 ? (
            <EmptyState
              variant="messages"
              message="Classmates will appear here after students are added."
            />
          ) : filteredClassmates.length === 0 ? (
            <EmptyState
              variant="messages"
              message="No classmates match your search."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleClassmates.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 rounded-3xl border border-border bg-background/60 p-4"
                  >
                    <span className="grid size-10 place-items-center rounded-full bg-muted text-xs font-bold">
                      {initials(student.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {student.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {student.username
                          ? `@${student.username}`
                          : student.email}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              {filteredClassmates.length > visibleClassmates.length ? (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setVisibleCount((count) => count + CLASS_DETAIL_PAGE_SIZE)
                    }
                  >
                    Load more classmates
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StudentClassroomDetail({
  classRecord,
  initialTab = "stream",
}: {
  classRecord: StudentClassRow;
  initialTab?: "stream" | "classwork" | "materials" | "people";
}) {
  const [tab, setTab] = useState(initialTab);
  const reduceMotion = useReducedMotion();
  const tabs = [
    { value: "stream", label: "Stream", icon: Megaphone },
    { value: "classwork", label: "Classwork", icon: ClipboardList },
    { value: "materials", label: "Materials", icon: BookOpen },
    { value: "people", label: "People", icon: UsersRound },
  ] as const;
  const summaryStats = [
    ["Assignments", classRecord.assignmentCount, ClipboardList],
    ["Materials", classRecord.resourceCount, BookOpen],
    ["Posts", classRecord.announcementCount, Megaphone],
    ["People", classRecord.classmates.length, UsersRound],
  ] as const;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Button asChild size="sm" variant="ghost" className="px-0">
        <Link href="/student/classes">
          Back to classes <ChevronRight className="rotate-180" />
        </Link>
      </Button>
      <ClassHero classRecord={classRecord} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summaryStats.map(([label, value, Icon]) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (label === "Assignments") setTab("classwork");
              if (label === "Materials") setTab("materials");
              if (label === "Posts") setTab("stream");
              if (label === "People") setTab("people");
            }}
            className="rounded-2xl border border-border bg-card/78 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-muted"
          >
            <Icon className="mb-2 size-4 text-primary" />
            <p className="text-xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      <div className="glass-panel sticky top-3 z-20 flex gap-2 overflow-x-auto rounded-full p-1 lg:top-24">
        {tabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "inline-flex min-w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
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
          {tab === "stream" ? <StreamPanel classRecord={classRecord} /> : null}
          {tab === "classwork" ? (
            <StudentAssignmentsPanel assignments={classRecord.assignments} />
          ) : null}
          {tab === "materials" ? (
            <MaterialsPanel classRecord={classRecord} />
          ) : null}
          {tab === "people" ? <PeoplePanel classRecord={classRecord} /> : null}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
