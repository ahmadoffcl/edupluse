"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, BookOpen, Save, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AdminClassRow,
  AdminTeacherOption,
} from "@/lib/dashboard/admin-classes";
import { cn } from "@/lib/utils";

type EditableClass = Omit<
  AdminClassRow,
  "studentCount" | "assignmentCount" | "materialCount" | "teacherName"
> & {
  studentCount?: number;
  assignmentCount?: number;
  materialCount?: number;
  teacherName?: string | null;
};

function emptyClass(): EditableClass {
  return {
    id: "new",
    name: "",
    description: "",
    bannerUrl: "",
    section: "",
    gradeLevel: "",
    batch: "",
    term: "",
    deliveryMode: "hybrid",
    capacity: null,
    scheduleNote: "",
    teacherId: null,
    teacherName: null,
    archivedAt: null,
  };
}

function payloadForClass(value: EditableClass) {
  return {
    name: value.name,
    description: value.description || null,
    bannerUrl: value.bannerUrl || null,
    section: value.section || null,
    gradeLevel: value.gradeLevel || null,
    batch: value.batch || null,
    term: value.term || null,
    deliveryMode: value.deliveryMode as "physical" | "online" | "hybrid",
    capacity: value.capacity,
    scheduleNote: value.scheduleNote || null,
    teacherId: value.teacherId || null,
  };
}

export function AdminClassesPanel({
  classes: initialClasses,
  teachers,
}: {
  classes: AdminClassRow[];
  teachers: AdminTeacherOption[];
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [selected, setSelected] = useState<EditableClass>(
    initialClasses[0] ?? emptyClass(),
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredClasses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return classes;

    return classes.filter((classRecord) =>
      [
        classRecord.name,
        classRecord.section,
        classRecord.batch,
        classRecord.term,
        classRecord.teacherName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [classes, query]);

  function patchSelected(patch: Partial<EditableClass>) {
    setSelected((current) => ({ ...current, ...patch }));
  }

  async function saveClass() {
    if (!selected.name.trim()) {
      toast.error("Class name is required.");
      return;
    }

    setSaving(true);
    try {
      const creating = selected.id === "new";
      const response = await fetch(
        creating ? "/api/admin/classes" : `/api/admin/classes/${selected.id}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadForClass(selected)),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Class could not be saved.");
      }

      const teacher = teachers.find(
        (teacherRecord) => teacherRecord.id === selected.teacherId,
      );
      const saved: AdminClassRow = {
        ...selected,
        id: creating ? (payload?.id ?? crypto.randomUUID()) : selected.id,
        teacherName: teacher?.name ?? null,
        studentCount: selected.studentCount ?? 0,
        assignmentCount: selected.assignmentCount ?? 0,
        materialCount: selected.materialCount ?? 0,
      };

      setClasses((current) =>
        creating
          ? [saved, ...current]
          : current.map((classRecord) =>
              classRecord.id === selected.id ? saved : classRecord,
            ),
      );
      setSelected(saved);
      toast.success(creating ? "Class created." : "Class updated.");
    } catch (error) {
      toast.error("Class action failed", {
        description:
          error instanceof Error ? error.message : "Check the class details.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (selected.id === "new") return;

    const archived = !selected.archivedAt;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/classes/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Class status could not be changed.");
      }

      const archivedAt = archived ? new Date().toISOString() : null;
      setSelected((current) => ({ ...current, archivedAt }));
      setClasses((current) =>
        current.map((classRecord) =>
          classRecord.id === selected.id ? { ...classRecord, archivedAt } : classRecord,
        ),
      );
      toast.success(archived ? "Class archived." : "Class restored.");
    } catch (error) {
      toast.error("Class status failed", {
        description:
          error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Classes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Search, select, and edit every class in the institute.
            </p>
          </div>
          <Button type="button" onClick={() => setSelected(emptyClass())}>
            <BookOpen />
            New class
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search classes, section, teacher"
              className="pl-11"
            />
          </div>

          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {filteredClasses.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border bg-background/50 p-5 text-sm text-muted-foreground">
                No classes match your search.
              </div>
            ) : null}
            {filteredClasses.map((classRecord) => (
              <button
                key={classRecord.id}
                type="button"
                onClick={() => setSelected(classRecord)}
                className={cn(
                  "w-full rounded-[1.35rem] border border-border bg-background/60 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
                  selected.id === classRecord.id &&
                    "border-primary/40 bg-primary/8 shadow-lg",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {classRecord.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        classRecord.teacherName,
                        classRecord.section && `Sec ${classRecord.section}`,
                        classRecord.term,
                      ]
                        .filter(Boolean)
                        .join(" - ") || "No teacher assigned"}
                    </p>
                  </div>
                  <Badge variant={classRecord.archivedAt ? "secondary" : "success"}>
                    {classRecord.archivedAt ? "Archived" : "Live"}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {[
                    ["Students", classRecord.studentCount],
                    ["Work", classRecord.assignmentCount],
                    ["Files", classRecord.materialCount],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-2xl border border-border bg-card/70 p-2"
                    >
                      <p className="font-semibold">{value}</p>
                      <p className="truncate text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="xl:sticky xl:top-24 xl:self-start">
        <CardHeader>
          <CardTitle>
            {selected.id === "new" ? "Create class" : "Edit class"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Change class identity, teacher, capacity, schedule note, and status.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Class name</span>
              <Input
                value={selected.name}
                onChange={(event) => patchSelected({ name: event.target.value })}
                placeholder="BSCS 2nd Semester"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Section</span>
              <Input
                value={selected.section ?? ""}
                onChange={(event) =>
                  patchSelected({ section: event.target.value })
                }
                placeholder="A"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Teacher</span>
              <select
                value={selected.teacherId ?? ""}
                onChange={(event) =>
                  patchSelected({ teacherId: event.target.value || null })
                }
                className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none"
              >
                <option value="">No teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                    {teacher.email ? ` - ${teacher.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Program / grade</span>
              <Input
                value={selected.gradeLevel ?? ""}
                onChange={(event) =>
                  patchSelected({ gradeLevel: event.target.value })
                }
                placeholder="BSCS"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Batch</span>
              <Input
                value={selected.batch ?? ""}
                onChange={(event) =>
                  patchSelected({ batch: event.target.value })
                }
                placeholder="FALL-2025"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Term</span>
              <Input
                value={selected.term ?? ""}
                onChange={(event) => patchSelected({ term: event.target.value })}
                placeholder="Spring 2026"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Capacity</span>
              <Input
                type="number"
                min={1}
                value={selected.capacity ?? ""}
                onChange={(event) =>
                  patchSelected({
                    capacity: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
                placeholder="60"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Mode</span>
              <select
                value={selected.deliveryMode}
                onChange={(event) =>
                  patchSelected({ deliveryMode: event.target.value })
                }
                className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm outline-none"
              >
                <option value="hybrid">Hybrid</option>
                <option value="physical">Physical</option>
                <option value="online">Online</option>
              </select>
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Banner image URL</span>
              <Input
                value={selected.bannerUrl ?? ""}
                onChange={(event) =>
                  patchSelected({ bannerUrl: event.target.value })
                }
                placeholder="https://..."
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Description</span>
              <textarea
                value={selected.description ?? ""}
                onChange={(event) =>
                  patchSelected({ description: event.target.value })
                }
                rows={3}
                className="w-full rounded-[1.35rem] border border-border bg-background px-4 py-3 text-sm outline-none"
                placeholder="What students should know about this class"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Schedule note</span>
              <textarea
                value={selected.scheduleNote ?? ""}
                onChange={(event) =>
                  patchSelected({ scheduleNote: event.target.value })
                }
                rows={2}
                className="w-full rounded-[1.35rem] border border-border bg-background px-4 py-3 text-sm outline-none"
                placeholder="Hybrid timing, venue notes, or special instructions"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveClass} disabled={saving}>
              <Save />
              {saving ? "Saving..." : "Save class"}
            </Button>
            {selected.id !== "new" ? (
              <Button
                type="button"
                variant="outline"
                onClick={toggleArchive}
                disabled={saving}
              >
                <Archive />
                {selected.archivedAt ? "Restore" : "Archive"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
