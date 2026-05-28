import { MessageSquareText, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/dashboard/content-blocks";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { StudentPerformanceData } from "@/lib/dashboard/student-performance";
import { formatDate } from "@/lib/utils";

function bandVariant(band: string) {
  if (band === "high_momentum") return "success";
  if (band === "steady") return "info";
  if (band === "watch") return "warning";
  return "danger";
}

export function StudentPerformancePanel({
  data,
}: {
  data: StudentPerformanceData;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            Performance index
          </CardTitle>
          <CardDescription>
            Based on real submissions, grades, XP, missing work, late work, and
            recent momentum.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-border bg-background/60 p-3 sm:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <Badge variant={bandVariant(data.band)}>
                  {data.band.replace("_", " ")}
                </Badge>
                <p className="mt-2 text-3xl font-semibold sm:text-4xl">
                  {data.performanceScore}
                </p>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <span>Attendance {data.attendancePercent}%</span>
                <span>Submissions {data.submittedPercent}%</span>
                <span>Score avg {data.averageScore}%</span>
                <span>{data.xp} XP</span>
              </div>
            </div>
            <Progress className="mt-5" value={data.performanceScore} />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-muted/40 p-3">
                <p className="text-lg font-semibold sm:text-xl">
                  {data.missingCount}
                </p>
                <p className="text-sm text-muted-foreground">missing items</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-3">
                <p className="text-lg font-semibold sm:text-xl">
                  {data.lateCount}
                </p>
                <p className="text-sm text-muted-foreground">late items</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="size-5 text-primary" />
            Teacher feedback
          </CardTitle>
          <CardDescription>
            Returned work and grading comments from your teachers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.feedback.length === 0 && (
            <EmptyState
              variant="assignments"
              message="No graded feedback is available yet."
            />
          )}
          {data.feedback.map((item) => (
            <div
              key={`${item.title}-${item.gradedAt ?? "feedback"}`}
              className="rounded-2xl border border-border bg-background/60 p-3 sm:rounded-3xl sm:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.feedback ?? "No written feedback added."}
                  </p>
                </div>
                <Badge variant="success">
                  {item.score === null ? "Returned" : `${item.score}%`}
                </Badge>
              </div>
              {item.gradedAt && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Returned {formatDate(item.gradedAt)}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
