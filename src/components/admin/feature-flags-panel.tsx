"use client";

import { useState } from "react";
import { BrainCircuit, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function FeatureFlagsPanel({
  smartLearningEnabled,
}: {
  smartLearningEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(smartLearningEnabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smartLearningEnabled: next }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error ?? "Unable to update feature.");
      }
      setEnabled(next);
      toast.success(
        next ? "Smart Learning enabled." : "Smart Learning hidden.",
      );
    } catch (error) {
      toast.error("Feature toggle failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <BrainCircuit className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Smart Learning / Missions</h2>
              <Badge variant={enabled ? "success" : "secondary"}>
                {enabled ? "Visible" : "Hidden"}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Turn this on when you want Missions, Smart Learning widgets,
              mission navigation, and related teacher signals to appear across
              EduPulse.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant={enabled ? "outline" : "default"}
          className="w-full rounded-full lg:w-auto"
          disabled={busy}
          onClick={toggle}
        >
          {enabled ? <PowerOff /> : <Power />}
          {busy ? "Saving..." : enabled ? "Hide feature" : "Turn on feature"}
        </Button>
      </CardContent>
    </Card>
  );
}
