"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Loader2,
  RefreshCw,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";

type ReportPayload = {
  assignment: {
    id: string;
    title: string;
    className: string;
    section: string | null;
  };
  submission: {
    id: string;
    studentId: string;
    studentName: string;
    studentUsername: string | null;
    submittedAt: string;
    content: string | null;
    filePath: string | null;
    mimeType: string | null;
    originalFilename: string | null;
    fileSize: number | null;
    signedUrl: string | null;
  };
  report: {
    id: string;
    status: string;
    aiRiskScore: number;
    aiRiskBand: string;
    similarityScore: number;
    extractedWordCount: number;
    checkedPeerCount: number;
    extractionStatus: string;
    evidence: {
      aiSignals?: string[];
      aiExplanation?: string;
      extractionReason?: string;
      excludedCoverPage?: boolean;
      mimeType?: string;
      originalFilename?: string;
    };
    guidance: string;
    updatedAt: string;
  } | null;
  matches: Array<{
    id: string;
    similarityScore: number;
    matchedSubmissionId: string;
    matchedStudentId: string;
    matchedStudentName: string;
    matchedSnippets: Array<{
      phrase: string;
      targetSnippet: string;
      matchedSnippet: string;
    }>;
  }>;
};

function riskVariant(score: number) {
  if (score >= 70) return "danger";
  if (score >= 40) return "warning";
  return "success";
}

function riskLabel(score: number) {
  if (score >= 70) return "Review advised";
  if (score >= 40) return "Needs context";
  return "Low concern";
}

function highlightSnippet(snippet: string, phrase: string) {
  const firstWords = phrase.split(" ").slice(0, 4).join(" ");
  const index = snippet.toLowerCase().indexOf(firstWords.toLowerCase());
  if (index < 0) return snippet;

  return (
    <>
      {snippet.slice(0, index)}
      <mark className="rounded bg-amber-300/40 px-1 text-foreground">
        {snippet.slice(index, Math.min(snippet.length, index + phrase.length))}
      </mark>
      {snippet.slice(Math.min(snippet.length, index + phrase.length))}
    </>
  );
}

function LoadingReport() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-36 rounded-[1.5rem]" />
      <div className="grid gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-[1.5rem]" />
    </div>
  );
}

export function IntegrityReportPanel({
  assignmentId,
  submissionId,
}: {
  assignmentId: string;
  submissionId: string;
}) {
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/teacher/assignments/${assignmentId}/checks/${submissionId}`;

  const load = useCallback(async () => {
    setError("");
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      data?: ReportPayload;
      error?: string;
    } | null;
    if (!response.ok || payload?.ok === false || !payload?.data) {
      throw new Error(payload?.error ?? "Unable to load report.");
    }
    setData(payload.data);
    return payload.data;
  }, [endpoint]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        data?: ReportPayload;
        error?: string;
      } | null;
      if (!response.ok || payload?.ok === false || !payload?.data) {
        throw new Error(payload?.error ?? "Unable to generate report.");
      }
      setData(payload.data);
      toast.success("Checks report updated.");
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate report.";
      setError(message);
      toast.error("Report failed", { description: message });
    } finally {
      setGenerating(false);
    }
  }, [endpoint]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await load();
        if (!cancelled && !loaded.report) {
          await generate();
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Unable to load report.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generate, load]);

  const file = useMemo(() => {
    if (!data?.submission.signedUrl) return null;
    return {
      name: data.submission.originalFilename ?? "Submission file",
      mimeType: data.submission.mimeType,
      signedUrl: data.submission.signedUrl,
      downloadName: data.submission.originalFilename ?? "submission",
      source: "submission" as const,
    };
  }, [data]);

  if (loading) return <LoadingReport />;

  if (error && !data) {
    return (
      <Card className="border-red-400/20 bg-red-500/8">
        <CardContent className="p-5">
          <Badge variant="danger">Report unavailable</Badge>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={() => void generate()}>
            <RefreshCw /> Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;
  const report = data.report;
  const aiSignals = report?.evidence.aiSignals ?? [];
  const unsupported =
    report?.status === "unsupported" || report?.status === "failed";

  async function copyGuidance() {
    if (!report?.guidance) return;
    await navigator.clipboard.writeText(report.guidance);
    toast.success("Teacher notes copied.");
  }

  const summaryCards: Array<{
    label: string;
    value: string | number;
    Icon: LucideIcon;
  }> = [
    {
      label: "AI-use risk",
      value: report ? `${report.aiRiskScore}%` : "-",
      Icon: ShieldAlert,
    },
    {
      label: "Similarity",
      value: report ? `${report.similarityScore}%` : "-",
      Icon: FileSearch,
    },
    {
      label: "Peers checked",
      value: report ? report.checkedPeerCount : 0,
      Icon: CheckCircle2,
    },
    {
      label: "Words analyzed",
      value: report ? report.extractedWordCount : 0,
      Icon: BrainCircuit,
    },
  ];

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_34%),hsl(var(--card)/0.94)]">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge>{data.assignment.className}</Badge>
                <Badge variant="secondary">
                  {data.submission.studentUsername
                    ? `@${data.submission.studentUsername}`
                    : data.submission.studentName}
                </Badge>
                {report ? (
                  <Badge variant={riskVariant(report.aiRiskScore)}>
                    {riskLabel(report.aiRiskScore)}
                  </Badge>
                ) : null}
                {report ? (
                  <Badge variant="secondary">Report {report.status}</Badge>
                ) : null}
                {report?.evidence.excludedCoverPage ? (
                  <Badge variant="info">Cover page excluded</Badge>
                ) : null}
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-4xl">
                {data.assignment.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Submitted by {data.submission.studentName} on{" "}
                {formatDateTime(data.submission.submittedAt)}
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                This report shows evidence and review signals only. It should
                support a teacher conversation, not replace teacher judgment.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {file ? (
                <>
                  <FilePreviewButton file={file} />
                  <FileDownloadButton file={file} />
                </>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={generating}
                onClick={() => void generate()}
              >
                {generating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
                Regenerate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {generating ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking submission, extracting text, and comparing classmates...
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        {summaryCards.map(({ label, value, Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <Icon className="mb-3 size-5 text-primary" />
              <p className="text-2xl font-semibold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {unsupported ? (
        <Card className="border-amber-400/20 bg-amber-500/8">
          <CardContent className="p-5">
            <Badge variant="warning">Manual review needed</Badge>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {report?.evidence.extractionReason ??
                "This submission can be previewed manually but is not deeply analyzable yet."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-primary" />
              AI-use risk evidence
            </CardTitle>
            <CardDescription>
              Writing-pattern signals, not a final detector verdict.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={cn(
                "rounded-3xl border p-4",
                report && report.aiRiskScore >= 70
                  ? "border-red-400/20 bg-red-500/8"
                  : report && report.aiRiskScore >= 40
                    ? "border-amber-400/20 bg-amber-500/8"
                    : "border-emerald-400/20 bg-emerald-500/8",
              )}
            >
              <p className="text-3xl font-semibold">
                {report ? `${report.aiRiskScore}%` : "-"}
              </p>
              <p className="text-sm text-muted-foreground">
                {report ? riskLabel(report.aiRiskScore) : "No report yet"}
              </p>
            </div>
            {aiSignals.length === 0 ? (
              <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
                No strong writing-pattern signals were recorded.
              </p>
            ) : (
              aiSignals.map((signal) => (
                <div
                  key={signal}
                  className="rounded-2xl border border-border bg-background/70 p-3 text-sm"
                >
                  {signal}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="size-5 text-primary" />
              Similarity checker
            </CardTitle>
            <CardDescription>
              Compared only with other submissions for this assignment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.matches.length === 0 ? (
              <div className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
                No meaningful similarity matches were found.
              </div>
            ) : (
              data.matches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-3xl border border-border bg-background/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {match.matchedStudentName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Matched submission
                      </p>
                    </div>
                    <Badge
                      variant={
                        match.similarityScore >= 35 ? "danger" : "warning"
                      }
                    >
                      {match.similarityScore}% match
                    </Badge>
                  </div>
                  <Button asChild className="mt-3" size="sm" variant="outline">
                    <Link
                      href={`/teacher/assignments/${data.assignment.id}/checks/${match.matchedSubmissionId}`}
                    >
                      <ExternalLink /> Open matched report
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matched highlights</CardTitle>
          <CardDescription>
            Cover pages are excluded where the extractor can identify them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.matches.flatMap((match) =>
            match.matchedSnippets.slice(0, 3).map((snippet, index) => (
              <div
                key={`${match.id}-${index}`}
                className="grid gap-3 rounded-3xl border border-border bg-background/60 p-4 lg:grid-cols-2"
              >
                <div>
                  <Badge variant="secondary">Current submission</Badge>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {highlightSnippet(snippet.targetSnippet, snippet.phrase)}
                  </p>
                </div>
                <div>
                  <Badge variant="warning">{match.matchedStudentName}</Badge>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {highlightSnippet(snippet.matchedSnippet, snippet.phrase)}
                  </p>
                </div>
              </div>
            )),
          )}
          {data.matches.length === 0 ? (
            <div className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
              No matched passages to highlight.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="size-5 text-primary" />
            Teacher guidance
          </CardTitle>
          <CardDescription>
            Neutral review questions and feedback wording based on evidence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap rounded-3xl border border-border bg-muted/50 p-4 text-sm leading-6">
            {report?.guidance ??
              "Generate a report to receive teacher guidance for this submission."}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!report?.guidance}
              onClick={() => void copyGuidance()}
            >
              <Copy /> Copy teacher notes
            </Button>
            {file?.signedUrl ? (
              <Button asChild type="button" variant="outline">
                <a href={file.signedUrl} download={file.downloadName}>
                  <Download /> Download evidence file
                </a>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-400/20 bg-amber-500/8">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          This report is a teaching aid. Similarity and AI-use risk are signals
          for careful review, not proof of misconduct.
        </CardContent>
      </Card>
    </div>
  );
}
