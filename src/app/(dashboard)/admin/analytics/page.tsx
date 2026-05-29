import {
  CompletionDonut,
  EngagementChart,
  MetricBarChart,
} from "@/components/dashboard/charts";
import { AnalyticsCockpit } from "@/components/dashboard/analytics-cockpit";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { PageHeader } from "@/components/dashboard/page-header";
import { RiskRadarPanel } from "@/components/dashboard/content-blocks";
import { getMissionEngagementSummary } from "@/lib/dashboard/admin-mission-analytics";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function AdminAnalyticsPage() {
  const [data, missionSummary] = await Promise.all([
    getDashboardData(),
    getMissionEngagementSummary(),
  ]);
  const activeUsers = data.metrics.find(
    (metric) => metric.label === "Active records",
  );
  const assignmentMetric = data.metrics.find(
    (metric) => metric.label === "Assignments",
  );
  const signalBars = data.metrics
    .map((metric) => ({
      name: metric.label.replace("Active records", "Users"),
      value: Number.parseInt(metric.value.replace(/[^0-9]/g, ""), 10) || 0,
    }))
    .filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Institute analytics without fake numbers."
        description="Real users, class activity, assignments, notifications, and engagement signals from your workspace."
      />
      <AnalyticsCockpit
        eyebrow="Admin intelligence"
        title="A clean operating picture for your institution."
        description="Track adoption, classwork flow, and risk signals without clutter or made-up engagement."
        cards={[
          {
            label: activeUsers?.label ?? "Active users",
            value: activeUsers?.value ?? "0",
            meta: activeUsers?.delta ?? "Live profiles",
            tone: "primary",
            icon: "users",
          },
          {
            label: assignmentMetric?.label ?? "Assignments",
            value: assignmentMetric?.value ?? "0",
            meta: assignmentMetric?.delta ?? "Live classwork",
            tone: "info",
            icon: "work",
          },
          {
            label: "Open risk signals",
            value: data.riskSignals.length,
            meta: "Calculated from live records",
            tone: "warning",
            icon: "risk",
          },
          {
            label: "Mission engagement",
            value: missionSummary.completed,
            meta: `${missionSummary.activeStudents} active students`,
            tone: "success",
            icon: "activity",
          },
        ]}
      />
      <MetricGrid metrics={data.metrics.slice(0, 4)} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <EngagementChart data={data.engagementChart} />
        <CompletionDonut data={data.assignmentStatusChart} />
      </div>
      <MetricBarChart
        data={[
          ...signalBars,
          ...(missionSummary.total > 0
            ? [
                { name: "Missions", value: missionSummary.total },
                { name: "Mission actions", value: missionSummary.events },
                { name: "Urgent blockers", value: missionSummary.urgent },
              ]
            : []),
        ]}
      />
      {missionSummary.total > 0 ? (
        <RiskRadarPanel
          items={[
            {
              label: "Open Smart Missions",
              count: missionSummary.open,
              severity: "medium",
            },
            {
              label: "Urgent mission blockers",
              count: missionSummary.urgent,
              severity: missionSummary.urgent > 0 ? "high" : "medium",
            },
            {
              label: "Classes with blockers",
              count: missionSummary.classesWithBlockers,
              severity: "medium",
            },
          ]}
        />
      ) : null}
      <RiskRadarPanel items={data.riskSignals} />
    </div>
  );
}
