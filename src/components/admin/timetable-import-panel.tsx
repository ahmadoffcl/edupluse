"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BellRing, CalendarClock, CheckCircle2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AdminTimetableClass,
  AdminTimetableImport,
  AdminTimetableSlot,
} from "@/lib/dashboard/admin-timetable";
import { cn } from "@/lib/utils";

const days = [
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
  ["7", "Sun"],
];

type ImportPayload = {
  import: AdminTimetableImport;
  slots: AdminTimetableSlot[];
};

function slotReady(slot: AdminTimetableSlot) {
  return Boolean(slot.active && slot.classId && slot.startTime && slot.endTime);
}

export function TimetableImportPanel({
  imports: initialImports,
  slots: initialSlots,
  classes,
}: {
  imports: AdminTimetableImport[];
  slots: AdminTimetableSlot[];
  classes: AdminTimetableClass[];
}) {
  const [imports, setImports] = useState(initialImports);
  const [slots, setSlots] = useState(initialSlots);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const activeImport = imports[0] ?? null;

  const readyCount = useMemo(() => slots.filter(slotReady).length, [slots]);
  const needsReview = slots.length - readyCount;
  const sections = useMemo(
    () => Array.from(new Set(slots.map((slot) => slot.sectionLabel))),
    [slots],
  );

  async function uploadTimetable(formData: FormData) {
    setUploading(true);
    try {
      const response = await fetch("/api/admin/timetable/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | (ImportPayload & { ok?: boolean; error?: string })
        | null;

      if (!response.ok || !payload?.import) {
        throw new Error(payload?.error ?? "Timetable import failed.");
      }

      setImports((current) => [payload.import, ...current]);
      setSlots(payload.slots);
      toast.success("Timetable imported", {
        description: `${payload.slots.length} class slots are ready for review.`,
      });
    } catch (error) {
      toast.error("Timetable import failed", {
        description:
          error instanceof Error ? error.message : "Try another PDF file.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function publishTimetable() {
    if (!activeImport) return;
    setPublishing(true);
    try {
      const response = await fetch(
        `/api/admin/timetable/${activeImport.id}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slots: slots.map((slot) => ({
              id: slot.id,
              classId: slot.classId,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              subjectName: slot.subjectName,
              teacherName: slot.teacherName,
              venue: slot.venue,
              active: slot.active,
            })),
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        readyCount?: number;
        materialized?: number;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Publish failed.");
      }

      setImports((current) =>
        current.map((item, index) =>
          index === 0
            ? {
                ...item,
                status: "published",
                publishedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      toast.success("Timetable published", {
        description: `${payload?.readyCount ?? readyCount} slots are now sending class reminders.`,
      });
    } catch (error) {
      toast.error("Publish failed", {
        description:
          error instanceof Error ? error.message : "Review the timetable rows.",
      });
    } finally {
      setPublishing(false);
    }
  }

  function updateSlot(id: string, patch: Partial<AdminTimetableSlot>) {
    setSlots((current) =>
      current.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)),
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1.1fr_0.9fr] md:p-5">
          <div className="rounded-[1.5rem] border border-border bg-background/60 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                <UploadCloud className="size-5" />
              </span>
              <div>
                <p className="font-semibold">Upload timetable PDF</p>
                <p className="text-sm text-muted-foreground">
                  EduPulse detects sections and class slots, then lets you
                  review before reminders go live.
                </p>
              </div>
            </div>
            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void uploadTimetable(new FormData(event.currentTarget));
              }}
            >
              <Input
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                required
                className="sm:flex-1"
              />
              <Button type="submit" disabled={uploading}>
                <UploadCloud />
                {uploading ? "Reading..." : "Import"}
              </Button>
            </form>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Sections", value: sections.length, Icon: CalendarClock },
              { label: "Ready", value: readyCount, Icon: CheckCircle2 },
              { label: "Review", value: needsReview, Icon: BellRing },
            ].map(({ label, value, Icon }) => (
              <div
                key={label}
                className="rounded-[1.35rem] border border-border bg-background/60 p-3"
              >
                <Icon className="mb-3 size-4 text-primary" />
                <p className="text-xl font-semibold">{value}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Review timetable slots</CardTitle>
            <p className="text-sm text-muted-foreground">
              Confirm class mapping and times. Only ready rows send reminders.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={activeImport?.status === "published" ? "success" : "warning"}>
              {activeImport?.status ?? "No import"}
            </Badge>
            <Button
              type="button"
              disabled={!activeImport || publishing || readyCount === 0}
              onClick={publishTimetable}
            >
              <BellRing />
              {publishing ? "Publishing..." : "Publish reminders"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {slots.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-background/50 p-6 text-center text-sm text-muted-foreground">
              Upload the BSCS timetable PDF to review class notification slots.
            </div>
          ) : (
            <div className="space-y-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className={cn(
                    "grid gap-3 rounded-[1.35rem] border border-border bg-background/60 p-3 lg:grid-cols-[1.1fr_0.75fr_0.7fr_0.7fr_1fr_auto]",
                    slotReady(slot) && "border-primary/30 bg-primary/5",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {slot.subjectName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {slot.sectionLabel}
                    </p>
                  </div>

                  <select
                    value={slot.classId ?? ""}
                    onChange={(event) =>
                      updateSlot(slot.id, {
                        classId: event.target.value || null,
                      })
                    }
                    className="h-10 rounded-2xl border border-border bg-background px-3 text-sm outline-none"
                  >
                    <option value="">Choose class</option>
                    {classes.map((classRecord) => (
                      <option key={classRecord.id} value={classRecord.id}>
                        {classRecord.name}
                        {classRecord.meta ? ` - ${classRecord.meta}` : ""}
                      </option>
                    ))}
                  </select>

                  <select
                    value={String(slot.dayOfWeek)}
                    onChange={(event) =>
                      updateSlot(slot.id, {
                        dayOfWeek: Number(event.target.value),
                      })
                    }
                    className="h-10 rounded-2xl border border-border bg-background px-3 text-sm outline-none"
                  >
                    {days.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="time"
                      value={slot.startTime ?? ""}
                      onChange={(event) =>
                        updateSlot(slot.id, {
                          startTime: event.target.value || null,
                        })
                      }
                    />
                    <Input
                      type="time"
                      value={slot.endTime ?? ""}
                      onChange={(event) =>
                        updateSlot(slot.id, {
                          endTime: event.target.value || null,
                        })
                      }
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <Input
                      value={slot.teacherName ?? ""}
                      placeholder="Teacher"
                      onChange={(event) =>
                        updateSlot(slot.id, {
                          teacherName: event.target.value || null,
                        })
                      }
                    />
                    <Input
                      value={slot.venue ?? ""}
                      placeholder="Venue"
                      onChange={(event) =>
                        updateSlot(slot.id, {
                          venue: event.target.value || null,
                        })
                      }
                    />
                  </div>

                  <label className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-background/70 px-3 py-2 text-sm lg:justify-center">
                    <input
                      type="checkbox"
                      checked={slot.active}
                      onChange={(event) =>
                        updateSlot(slot.id, { active: event.target.checked })
                      }
                    />
                    <span>{slotReady(slot) ? "Ready" : "Skip"}</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
