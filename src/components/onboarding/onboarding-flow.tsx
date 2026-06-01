"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Search,
  Upload,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/providers/auth-provider";
import {
  UsernameAvailabilityNote,
  useUsernameAvailability,
} from "@/components/profile/username-availability";
import { markOnboardingComplete } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";

type OnboardingStep = {
  title: string;
  subtitle: string;
  fields: Array<{
    label: string;
    placeholder: string;
    type?: "text" | "textarea";
  }>;
  emptyTitle?: string;
  emptyText?: string;
};

type OnboardingClassOption = {
  id: string;
  name: string;
  description: string | null;
  section: string | null;
  teacherName: string | null;
  enrollmentStatus: "enrolled" | "pending" | "suggested" | "available";
  suggestedReason: string | null;
};

export function OnboardingFlow({
  audience,
  title,
  description,
  steps,
  finishHref,
  classOptions = [],
}: {
  audience: "student" | "teacher";
  title: string;
  description: string;
  steps: OnboardingStep[];
  finishHref: string;
  classOptions?: OnboardingClassOption[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(
    new Set(),
  );
  const progress = useMemo(
    () => Math.round(((active + 1) / steps.length) * 100),
    [active, steps.length],
  );
  const step = steps[active];
  const isLast = active === steps.length - 1;
  const usernameCheck = useUsernameAvailability(valueFor("Username"), "current");
  const usernameIsRequiredOnStep = step.fields.some(
    (field) => field.label === "Username",
  );
  const usernameBlocked =
    usernameIsRequiredOnStep &&
    (!usernameCheck.isAvailable || usernameCheck.isChecking);
  const classSearch = valueFor("Search classes").trim().toLowerCase();
  const filteredClassOptions = classOptions
    .filter((classRecord) => classRecord.enrollmentStatus !== "enrolled")
    .filter((classRecord) => {
      if (!classSearch) return true;
      return [
        classRecord.name,
        classRecord.description,
        classRecord.section,
        classRecord.teacherName,
        classRecord.suggestedReason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(classSearch);
    })
    .slice(0, 12);

  function fieldKey(stepTitle: string, fieldLabel: string) {
    return `${stepTitle}:${fieldLabel}`;
  }

  function valueFor(label: string) {
    const match = Object.entries(values).find(([key]) =>
      key.toLowerCase().endsWith(`:${label.toLowerCase()}`),
    );

    return match?.[1] ?? "";
  }

  async function finish() {
    if (usernameBlocked) {
      toast.error("Choose an available username first.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: valueFor("Display name") || undefined,
          username: valueFor("Username") || undefined,
          bio:
            valueFor("Bio or status") ||
            valueFor("Teacher tagline") ||
            valueFor("Short introduction") ||
            undefined,
          selectedClassIds: Array.from(selectedClassIds),
          academic:
            audience === "student"
              ? {
                  institutionName: valueFor("Institution name"),
                  departmentName: valueFor("Department name"),
                  program: valueFor("Degree or program"),
                  semesterYear: valueFor("Semester or year"),
                }
              : undefined,
          details:
            audience === "student"
              ? {
                  section: valueFor("Section"),
                  registrationNumber: valueFor("Registration number"),
                  studentId: valueFor("Student ID"),
                  campus: valueFor("Campus"),
                }
              : undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        setupPending?: boolean;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to save onboarding.");
      }

      if (!data?.setupPending) {
        markOnboardingComplete(audience, [user?.uid, user?.email]);
        toast.success("Profile saved");
      } else {
        toast.success("Setup accepted", {
          description: "Your dashboard is ready while workspace data syncs.",
        });
      }
      router.push(finishHref);
    } catch (error) {
      toast.error("Onboarding could not be saved", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8">
      <div className="premium-grid pointer-events-none absolute inset-x-0 top-0 h-[460px]" />
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="glass-panel rounded-[2rem] p-5">
          <p className="text-sm font-semibold capitalize text-primary">
            {audience} onboarding
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <Progress value={progress} className="mt-6" />
          <div className="mt-6 space-y-2">
            {steps.map((item, index) => (
              <button
                key={item.title}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm motion-safe",
                  index === active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setActive(index)}
                type="button"
              >
                <span className="grid size-8 place-items-center rounded-full bg-background font-mono text-xs">
                  {index < active ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    index + 1
                  )}
                </span>
                {item.title}
              </button>
            ))}
          </div>
        </aside>

        <Card className="overflow-hidden">
          <CardContent className="p-5 md:p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold text-primary">
                Step {active + 1} of {steps.length}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                {step.title}
              </h2>
              <p className="mt-2 text-muted-foreground">{step.subtitle}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {step.fields.map((field) => {
                const key = fieldKey(step.title, field.label);
                return (
                  <label key={field.label} className="space-y-2">
                    <span className="text-sm font-semibold">
                      {field.label}
                    </span>
                    <Input
                      placeholder={field.placeholder}
                      value={values[key] ?? ""}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                    {field.label === "Username" ? (
                      <UsernameAvailabilityNote
                        status={usernameCheck.status}
                        message={usernameCheck.message}
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>

            {step.emptyTitle &&
              !(
                audience === "student" && step.title === "Initial enrollment"
              ) && (
                <div className="mt-6 rounded-3xl border border-dashed border-border bg-background/50 p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                      <Search className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{step.emptyTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {step.emptyText}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline">
                    <Upload /> Add later
                  </Button>
                </div>
              )}

            {audience === "student" && step.title === "Initial enrollment" ? (
              <div className="mt-6 space-y-3">
                {filteredClassOptions.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border bg-background/50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                        <Search className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold">No matching classes yet</p>
                        <p className="text-sm text-muted-foreground">
                          You can finish setup now and request classes from your
                          dashboard later.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredClassOptions.map((classRecord) => {
                      const selected = selectedClassIds.has(classRecord.id);
                      return (
                        <button
                          key={classRecord.id}
                          type="button"
                          onClick={() =>
                            setSelectedClassIds((current) => {
                              const next = new Set(current);
                              if (next.has(classRecord.id)) {
                                next.delete(classRecord.id);
                              } else {
                                next.add(classRecord.id);
                              }
                              return next;
                            })
                          }
                          className={cn(
                            "rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background/60",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                              {selected ? (
                                <Check className="size-5" />
                              ) : (
                                <BookOpen className="size-5" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-1 font-semibold">
                                {classRecord.name}
                              </span>
                              <span className="mt-1 block text-sm text-muted-foreground">
                                {classRecord.teacherName ?? "Teacher"}{" "}
                                {classRecord.section
                                  ? `- Section ${classRecord.section}`
                                  : ""}
                              </span>
                            </span>
                            <Badge
                              variant={
                                classRecord.enrollmentStatus === "suggested"
                                  ? "success"
                                  : "secondary"
                              }
                            >
                              {classRecord.enrollmentStatus === "pending"
                                ? "Pending"
                                : classRecord.enrollmentStatus === "suggested"
                                  ? "Suggested"
                                  : "Available"}
                            </Badge>
                          </div>
                          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                            {classRecord.suggestedReason ??
                              classRecord.description ??
                              "Request access and your teacher can approve it."}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedClassIds.size > 0 ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 p-3 text-sm font-medium text-primary">
                    <UsersRound className="size-4" />
                    {selectedClassIds.size} class request
                    {selectedClassIds.size === 1 ? "" : "s"} will be sent.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={active === 0}
                onClick={() => setActive((value) => Math.max(0, value - 1))}
              >
                <ArrowLeft /> Back
              </Button>
              {isLast ? (
                <Button
                  type="button"
                  variant="premium"
                  disabled={busy || usernameBlocked}
                  onClick={finish}
                >
                  Finish setup <ArrowRight />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="premium"
                  onClick={() =>
                    setActive((value) => Math.min(steps.length - 1, value + 1))
                  }
                >
                  Continue <ArrowRight />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
