"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Download,
  Edit3,
  ExternalLink,
  FilePlus2,
  FileText,
  Link2,
  Search,
  Trash2,
  UploadCloud,
  X,
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
import type { StudentClassRow } from "@/lib/dashboard/server-data";
import type { Note } from "@/lib/types";
import { signAndUploadFile } from "@/lib/uploads/client";
import { cn, formatDate } from "@/lib/utils";

const NOTES_PAGE_SIZE = 15;

function noteKind(note: Note) {
  if (note.externalUrl) return "Link";
  if (note.fileUrl) return note.originalFilename ?? "File";
  return "Text note";
}

function noteHref(note: Note) {
  return note.fileUrl || note.externalUrl || null;
}

function NoteForm({
  classes,
  editing,
  onDone,
}: {
  classes: StudentClassRow[];
  editing?: Note | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);

    try {
      const file = form.get("file");
      const classId = String(form.get("classId") ?? "") || null;
      if (file instanceof File && file.size > 0) {
        const uploadedFile = await signAndUploadFile({
          purpose: "student_note",
          file,
          classId,
        });
        form.delete("file");
        form.set("uploadedFile", JSON.stringify(uploadedFile));
      }

      const response = await fetch(
        editing ? `/api/student/notes/${editing.id}` : "/api/student/notes",
        {
          method: editing ? "PATCH" : "POST",
          body: form,
        },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to save note.");
      }

      toast.success(editing ? "Note updated." : "Note uploaded.");
      event.currentTarget.reset();
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(editing ? "Update failed" : "Upload failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {editing ? (
            <Edit3 className="size-5 text-primary" />
          ) : (
            <FilePlus2 className="size-5 text-primary" />
          )}
          {editing ? "Edit your note" : "Upload a note"}
        </CardTitle>
        <CardDescription>
          Keep notes private, or attach them to a class you are enrolled in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              name="title"
              placeholder="Note title"
              defaultValue={editing?.title ?? ""}
              required
            />
            <select
              name="classId"
              defaultValue={editing?.classId ?? ""}
              className="flex h-11 w-full rounded-2xl border border-input bg-background/75 px-4 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            >
              <option value="">Private note</option>
              {classes.map((classRecord) => (
                <option key={classRecord.id} value={classRecord.id}>
                  {classRecord.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            name="externalUrl"
            placeholder="Optional link URL"
            defaultValue={editing?.externalUrl ?? ""}
          />
          <Textarea
            name="body"
            placeholder="Write your note, summary, checklist, or revision plan"
            defaultValue={editing?.body ?? ""}
          />
          {!editing ? (
            <Input
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.webm,.mp4,.mov"
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy}>
              <UploadCloud />
              {busy ? "Saving..." : editing ? "Save changes" : "Upload note"}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              <X /> Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function StudentNotesManager({
  notes,
  classes,
}: {
  notes: Note[];
  classes: StudentClassRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(NOTES_PAGE_SIZE);
  const ownNotes = notes.filter((note) => note.ownedByStudent);
  const teacherNotes = notes.filter((note) => !note.ownedByStudent);
  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes;

    return notes.filter((note) =>
      [
        note.title,
        note.subject,
        note.className,
        note.body,
        note.originalFilename,
        note.externalUrl,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [notes, query]);
  const visibleNotes = filteredNotes.slice(0, visibleCount);

  async function remove(note: Note) {
    setDeletingId(note.id);

    try {
      const response = await fetch(`/api/student/notes/${note.id}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error ?? "Unable to delete note.");
      }

      toast.success("Note deleted.");
      router.refresh();
    } catch (error) {
      toast.error("Delete failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Your notes", ownNotes.length, "Private and class-attached"],
          ["Teacher resources", teacherNotes.length, "Shared materials"],
          ["Classes", classes.length, "Available destinations"],
        ].map(([label, value, meta]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes, files, links, and classes"
              className="pl-11"
            />
          </div>
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <FilePlus2 /> Add note
          </Button>
          <Badge variant="secondary" className="md:ml-auto">
            {filteredNotes.length} item{filteredNotes.length === 1 ? "" : "s"}
          </Badge>
        </CardContent>
      </Card>

      {showForm || editing ? (
        <NoteForm
          classes={classes}
          editing={editing}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      ) : null}

      {filteredNotes.length === 0 ? (
        <EmptyState
          variant="notes"
          message="No notes match this view yet. Upload your first note or wait for a teacher to share materials."
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleNotes.map((note) => {
          const href = noteHref(note);
          const previewFile = note.fileUrl
            ? {
                name: note.originalFilename ?? note.title,
                mimeType: note.mimeType,
                signedUrl: note.fileUrl,
                downloadName: note.originalFilename ?? note.title,
                source: "resource" as const,
              }
            : null;
          return (
            <Card
              key={note.id}
              className={cn(
                "overflow-hidden transition hover:-translate-y-1 hover:shadow-xl",
                note.ownedByStudent && "border-primary/25",
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                    {note.externalUrl ? (
                      <Link2 className="size-5" />
                    ) : note.fileUrl ? (
                      <FileText className="size-5" />
                    ) : (
                      <BookOpen className="size-5" />
                    )}
                  </span>
                  <Badge variant={note.ownedByStudent ? "default" : "info"}>
                    {note.ownedByStudent ? "Your note" : "Teacher"}
                  </Badge>
                </div>
                <CardTitle className="line-clamp-2">{note.title}</CardTitle>
                <CardDescription>
                  {note.className ?? note.subject} - {noteKind(note)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {note.body ? (
                  <p className="line-clamp-3 rounded-2xl border border-border bg-background/60 p-3 text-sm text-muted-foreground">
                    {note.body}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {formatDate(note.updatedAt)}
                  </Badge>
                  <Badge variant="secondary">
                    {note.visibility === "class" ? "Class note" : "Private"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {previewFile ? (
                    <>
                      <FilePreviewButton file={previewFile} />
                      <FileDownloadButton file={previewFile} />
                    </>
                  ) : href ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={href} target="_blank" rel="noreferrer">
                        {note.fileUrl ? <Download /> : <ExternalLink />}
                        Open
                      </a>
                    </Button>
                  ) : null}
                  {note.ownedByStudent ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(note);
                          setShowForm(false);
                        }}
                      >
                        <Edit3 /> Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={deletingId === note.id}
                        onClick={() => remove(note)}
                      >
                        <Trash2 />
                        {deletingId === note.id ? "Deleting" : "Delete"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredNotes.length > visibleNotes.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((count) => count + NOTES_PAGE_SIZE)}
          >
            Load more notes
          </Button>
        </div>
      ) : null}
    </div>
  );
}
