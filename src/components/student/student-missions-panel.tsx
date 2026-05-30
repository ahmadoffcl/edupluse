"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Flame,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Target,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/content-blocks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  LearningMission,
  LearningMissionAction,
  LearningMissionFocusData,
  LearningMissionLane,
} from "@/lib/dashboard/learning-missions";
import { cn, formatDateTime } from "@/lib/utils";

const iconMap = {
  assignment_due: Clock3,
  missing_submission: AlertTriangle,
  new_resource: BookOpenCheck,
  teacher_feedback: MessageSquareText,
  study_streak: Flame,
  weak_topic: Target,
};

const laneDescriptions: Record<LearningMissionLane, string> = {
  due_soon: "Work with a real deadline coming up.",
  needs_attention: "Missing or risky work that can hurt progress.",
  new_from_teacher: "New files, notes, or posts from your teachers.",
  feedback: "Returned work you should read before moving on.",
  practice: "Small actions that keep your learning streak healthy.",
};

const laneOrder: LearningMissionLane[] = [
  "needs_attention",
  "due_soon",
  "new_from_teacher",
  "feedback",
  "practice",
];

const laneLabel: Record<LearningMissionLane, string> = {
  due_soon: "Due Soon",
  needs_attention: "Needs Attention",
  new_from_teacher: "New From Teacher",
  feedback: "Feedback",
  practice: "Practice",
};

function priorityVariant(priority: LearningMission["priority"]) {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "normal") return "info";
  return "secondary";
}

function statusVariant(status: LearningMission["status"]) {
  if (status === "completed") return "success";
  if (status === "dismissed") return "secondary";
  return "warning";
}

function sourceTone(mission: LearningMission) {
  if (mission.priority === "urgent") {
    return "border-red-400/25 bg-red-500/8 dark:bg-red-500/10";
  }
  if (mission.priority === "high") {
    return "border-amber-400/25 bg-amber-500/8 dark:bg-amber-500/10";
  }
  return "border-border bg-card/80 dark:bg-white/5";
}

function MissionCoach({
  mission,
  compact = false,
}: {
  mission: LearningMission;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(mission.aiExplanation ?? "");
  const [busy, setBusy] = useState(false);

  async function explain() {
    setOpen(true);
    if (answer || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/student/missions/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey: mission.sourceKey }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        text?: string;
        error?: string;
      } | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ?? "Unable to explain mission.");
      }

      setAnswer(payload?.text ?? "");
    } catch (error) {
      toast.error("Coach could not open", {
        description: error instanceof Error ? error.message : "Try again.",
      });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size={compact ? "sm" : "default"}
        variant="outline"
        onClick={explain}
      >
        <BrainCircuit />
        Coach
      </Button>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-[90] max-h-[82vh] overflow-auto rounded-t-[2rem] border border-border bg-card p-5 shadow-2xl outline-none sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(92vw,620px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">
                <BrainCircuit className="size-5 text-primary" />
                Smart study steps
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Based only on this real mission and its classroom context.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" size="icon" variant="ghost">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <div className="mt-5 rounded-3xl border border-border bg-background/70 p-4">
            <p className="text-sm font-semibold">{mission.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {mission.reason}
            </p>
          </div>
          <div className="mt-4 min-h-40 whitespace-pre-wrap rounded-3xl border border-border bg-muted/50 p-4 text-sm leading-6">
            {busy ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Building your plan...
              </span>
            ) : (
              answer
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MissionLoadingShell({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[1.6rem] border border-border/70 bg-card/72 p-4 shadow-[var(--shadow-glass)] sm:p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded-full bg-muted" />
          <div className="h-8 w-full max-w-lg rounded-full bg-muted" />
          <div className="h-4 w-full max-w-xl rounded-full bg-muted" />
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="h-16 rounded-2xl bg-muted" />
            <div className="h-16 rounded-2xl bg-muted" />
            <div className="h-16 rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
      {!compact ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse rounded-[1.35rem] border border-border/70 bg-card/72"
              />
            ))}
          </div>
          <div className="hidden h-72 animate-pulse rounded-[1.35rem] border border-border/70 bg-card/72 xl:block" />
        </div>
      ) : null}
    </div>
  );
}

function MissionCard({
  mission,
  index,
  compact = false,
  busyKey,
  onAction,
}: {
  mission: LearningMission;
  index: number;
  compact?: boolean;
  busyKey: string | null;
  onAction: (
    mission: LearningMission,
    action: LearningMissionAction,
    navigate?: boolean,
  ) => Promise<void>;
}) {
  const Icon = iconMap[mission.kind];
  const busy = busyKey?.startsWith(`${mission.sourceKey}:`) ?? false;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.025 }}
      className={cn(
        "group rounded-[1.55rem] border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl sm:p-4",
        sourceTone(mission),
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary sm:size-11">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={priorityVariant(mission.priority)}>
              {mission.priority === "urgent" ? "Do first" : mission.priority}
            </Badge>
            <Badge variant="secondary">{mission.sourceLabel}</Badge>
            <Badge variant={statusVariant(mission.status)}>
              {mission.status === "open" ? "ready" : mission.status}
            </Badge>
          </div>
          <h3 className="mt-2 text-sm font-semibold leading-5 sm:text-base">
            {mission.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {compact ? mission.reason : mission.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {mission.className ? (
              <span className="rounded-full bg-muted px-3 py-1 font-medium">
                {mission.className}
              </span>
            ) : null}
            {mission.timeLabel ? (
              <span className="rounded-full bg-muted px-3 py-1 font-medium">
                {mission.timeLabel}
              </span>
            ) : null}
          </div>
          {!compact ? (
            <div className="mt-3 grid gap-2 rounded-2xl border border-border/70 bg-background/72 p-3 text-sm sm:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Why now
                </p>
                <p className="mt-1 font-medium">{mission.reason}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Evidence
                </p>
                <p className="mt-1 text-muted-foreground">{mission.evidence}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
        <Button
          type="button"
          size="sm"
          className="w-full sm:w-auto"
          disabled={busy}
          onClick={() => onAction(mission, "start", true)}
        >
          <Zap />
          Start
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={busy}
          onClick={() => onAction(mission, "open_source", true)}
        >
          <ArrowRight />
          Open source
        </Button>
        {!compact ? <MissionCoach mission={mission} compact /> : null}
        {mission.status === "open" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => onAction(mission, "complete")}
            >
              <CheckCircle2 />
              Done
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => onAction(mission, "snooze")}
            >
              <Clock3 />
              Snooze
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => onAction(mission, "dismiss")}
            >
              <XCircle />
              Dismiss
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => onAction(mission, "reopen")}
          >
            Reopen
          </Button>
        )}
      </div>
    </motion.article>
  );
}

function FocusHero({
  mission,
  progress,
  busyKey,
  compact,
  onAction,
}: {
  mission: LearningMission | null;
  progress: LearningMissionFocusData["progress"];
  busyKey: string | null;
  compact: boolean;
  onAction: (
    mission: LearningMission,
    action: LearningMissionAction,
    navigate?: boolean,
  ) => Promise<void>;
}) {
  if (!mission) {
    return (
      <Card className="overflow-hidden border-emerald-400/20 bg-emerald-500/8">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge variant="success">Clear</Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                No missions right now. You are clear.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                New classwork, feedback, and teacher materials will appear here
                as soon as they exist.
              </p>
            </div>
            <span className="grid size-16 place-items-center rounded-[1.5rem] bg-emerald-400/12 text-emerald-500">
              <CheckCircle2 className="size-8" />
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/20 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_34%),hsl(var(--card)/0.94)] shadow-[0_24px_90px_-55px_hsl(var(--primary)/0.75)] dark:border-white/10 dark:bg-black dark:shadow-[0_24px_90px_-55px_rgb(255_255_255/0.18)]">
      <CardContent className={compact ? "p-4" : "p-4 sm:p-6"}>
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Daily Focus</Badge>
              <Badge variant={priorityVariant(mission.priority)}>
                {mission.timeLabel ?? mission.priority}
              </Badge>
              {progress.urgent > 0 ? (
                <Badge variant="danger">{progress.urgent} urgent</Badge>
              ) : null}
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Best next action
            </p>
            <h2 className="mt-2 text-xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {mission.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {mission.reason} Open the source, finish the work, then mark it
              done when you have handled it.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-border/70 bg-background/68 p-3 sm:p-4">
                <p className="text-sm font-semibold">Why this is here</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mission.evidence}
                </p>
              </div>
              <div className="rounded-3xl border border-border/70 bg-background/68 p-3 sm:p-4">
                <p className="text-sm font-semibold">Best path</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mission.className ? `${mission.className}: ` : ""}
                  start from the original source and use Coach only for study
                  steps.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
              <Button
                className="w-full sm:w-auto"
                disabled={Boolean(busyKey)}
                onClick={() => onAction(mission, "start", true)}
              >
                <Zap />
                Start focus
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={Boolean(busyKey)}
                onClick={() => onAction(mission, "complete")}
              >
                <CheckCircle2 />
                Mark done
              </Button>
              {!compact ? <MissionCoach mission={mission} /> : null}
            </div>
          </div>
          <div
            className={cn(
              "grid gap-3 sm:grid-cols-3 lg:grid-cols-1",
              compact && "hidden sm:grid",
            )}
          >
            {[
              ["Open", progress.open],
              ["Done", progress.completed],
              ["Snoozed", progress.snoozed],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-3xl border border-border/70 bg-card/70 p-4"
              >
                <p className="text-2xl font-semibold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentMissionsPanel({
  data,
  compact = false,
}: {
  data?: LearningMissionFocusData | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [focusData, setFocusData] = useState<LearningMissionFocusData | null>(
    data ?? null,
  );
  const [loading, setLoading] = useState(!data);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const activeData = focusData ?? data ?? null;

  const loadMissions = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/student/missions", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        data?: LearningMissionFocusData;
        error?: string;
      } | null;

      if (!response.ok || payload?.ok === false || !payload?.data) {
        throw new Error(payload?.error ?? "Unable to load missions.");
      }

      setFocusData(payload.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load missions.";
      setLoadError(message);
      if (!quiet) {
        toast.error("Missions unavailable", { description: message });
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (data) {
      const timer = window.setTimeout(() => {
        setFocusData(data);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      void loadMissions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data, loadMissions]);

  const secondaryMissions = useMemo(
    () =>
      (activeData?.visibleMissions ?? [])
        .filter(
          (mission) =>
            mission.sourceKey !== activeData?.focusMission?.sourceKey,
        )
        .filter((mission) => mission.status === "open")
        .slice(0, compact ? 2 : 8),
    [activeData?.focusMission?.sourceKey, activeData?.visibleMissions, compact],
  );

  async function updateMission(
    mission: LearningMission,
    action: LearningMissionAction,
    navigate = false,
  ) {
    if (navigate) {
      router.push(mission.sourceHref || mission.actionHref);
      void fetch("/api/student/missions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey: mission.sourceKey, action }),
      }).catch(() => undefined);
      return;
    }

    setBusyKey(`${mission.sourceKey}:${action}`);
    try {
      const response = await fetch("/api/student/missions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey: mission.sourceKey, action }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        data?: LearningMissionFocusData;
        error?: string;
      } | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ?? "Unable to update mission.");
      }

      if (action === "complete") toast.success("Mission completed.");
      if (action === "snooze") toast.success("Mission snoozed for later.");
      if (action === "dismiss") toast.success("Mission dismissed.");

      if (payload?.data) setFocusData(payload.data);
      else await loadMissions(true);
    } catch (error) {
      toast.error("Mission update failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function refreshMissions() {
    setRefreshing(true);
    try {
      await loadMissions(true);
      toast.success("Daily focus updated.");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !activeData) {
    return <MissionLoadingShell compact={compact} />;
  }

  if (!activeData) {
    return (
      <Card className="border-amber-400/20 bg-amber-500/8">
        <CardContent className="p-5">
          <Badge variant="warning">Missions paused</Badge>
          <p className="mt-3 text-sm text-muted-foreground">
            {loadError || "Your daily focus could not load right now."}
          </p>
          <Button className="mt-4" onClick={() => void loadMissions()}>
            <RefreshCw /> Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <Card className="border-blue-400/20 bg-blue-500/8 dark:border-white/10 dark:bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-500/12 text-blue-500">
                <Target className="size-5" />
              </span>
              <div>
                <p className="font-semibold">Smart Learning Missions</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  This is your automatic study checklist. It looks at real
                  assignments, teacher files, feedback, and deadlines, then
                  shows what to do next.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <FocusHero
          mission={activeData.focusMission}
          progress={activeData.progress}
          busyKey={busyKey}
          compact
          onAction={updateMission}
        />
        {secondaryMissions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {secondaryMissions.map((mission, index) => (
              <MissionCard
                key={mission.sourceKey}
                mission={mission}
                index={index}
                compact
                busyKey={busyKey}
                onAction={updateMission}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.9rem] bg-background/96 pb-3 backdrop-blur-xl lg:sticky lg:top-32 lg:z-10 dark:bg-black/96">
        <Card className="mb-3 overflow-hidden border-border/70 bg-card/88 dark:bg-white/5">
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Daily Focus Hub
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Know exactly what to do next.
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Smart Learning watches your real deadlines, submissions, teacher
                files, and returned feedback. It does not invent tasks; it
                organizes what already happened into a calm action plan.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-80">
              {[
                ["Open", activeData.progress.open],
                ["Done", activeData.progress.completed],
                ["Urgent", activeData.progress.urgent],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-background/70 p-3 text-center"
                >
                  <p className="text-lg font-semibold">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <FocusHero
          mission={activeData.focusMission}
          progress={activeData.progress}
          busyKey={busyKey}
          compact={false}
          onAction={updateMission}
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Updated from live classroom activity. Refresh when teachers add new
            work.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={refreshing}
            onClick={() => void refreshMissions()}
          >
            {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Refresh focus
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-5">
          {activeData.visibleMissions.length === 0 ? (
            <EmptyState
              variant="activity"
              message="No missions right now. You are clear."
            />
          ) : (
            laneOrder.map((lane) => {
              const missions = activeData.groupedMissions[lane];
              if (missions.length === 0) return null;
              return (
                <section
                  key={lane}
                  className="rounded-[1.6rem] border border-border/70 bg-card/72 p-3 shadow-sm sm:p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold sm:text-lg">
                        {laneLabel[lane]}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {laneDescriptions[lane]}
                      </p>
                    </div>
                    <Badge variant="secondary">{missions.length}</Badge>
                  </div>
                  <div className="grid gap-3">
                    {missions.map((mission, index) => (
                      <MissionCard
                        key={mission.sourceKey}
                        mission={mission}
                        index={index}
                        busyKey={busyKey}
                        onAction={updateMission}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </main>

        <aside className="space-y-4 xl:sticky xl:top-32 xl:self-start">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" />
                What changed?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeData.timeline.length === 0 ? (
                <div className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
                  New activity will appear here when teachers post work, return
                  feedback, or you act on missions.
                </div>
              ) : (
                activeData.timeline.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border bg-background/70 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <Badge variant="secondary">{item.kind}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.body}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Today’s progress</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                ["Open", activeData.progress.open],
                ["Completed", activeData.progress.completed],
                ["Urgent", activeData.progress.urgent],
                ["Total", activeData.progress.total],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-background/70 p-3"
                >
                  <p className="text-xl font-semibold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
