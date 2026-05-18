"use client";

import { useState } from "react";
import { BrainCircuit, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

export function AiPanel({
  mode = "study",
}: {
  mode?: "study" | "summary" | "quiz";
}) {
  const { user, token } = useAuth();
  const [prompt, setPrompt] = useState(
    mode === "quiz"
      ? "Momentum and impulse"
      : mode === "summary"
        ? "Paste a note, lesson, or resource text here..."
        : "Help me plan today around assignments and Physics revision.",
  );
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!user) return;
    setBusy(true);
    setAnswer("");

    try {
      const authToken = await token();
      const path =
        mode === "quiz"
          ? "/api/ai/quiz"
          : mode === "summary"
            ? "/api/ai/summary"
            : "/api/ai/study";
      const body =
        mode === "quiz"
          ? {
              topic: prompt,
              className: "Grade 10-A",
              difficulty: "medium",
              orgId: user.orgId,
            }
          : mode === "summary"
            ? { content: prompt, role: user.role, orgId: user.orgId }
            : { prompt, role: user.role, orgId: user.orgId };
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { text?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "AI request failed.");
      }

      setAnswer(data.text ?? "");
    } catch (error) {
      toast.error("AI request failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="size-5 text-primary" />
              EduPulse AI
            </CardTitle>
            <CardDescription>
              {mode === "quiz"
                ? "Draft teacher-reviewed quiz material."
                : mode === "summary"
                  ? "Summarize notes into study-ready actions."
                  : "Get a scoped study plan and concept help."}
            </CardDescription>
          </div>
          <Badge variant="info">OpenAI</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="min-h-32"
        />
        <Button onClick={run} disabled={busy} variant="premium">
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Generate
        </Button>
        {answer && (
          <div className="whitespace-pre-wrap rounded-3xl border border-border bg-muted p-4 text-sm leading-6">
            {answer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
