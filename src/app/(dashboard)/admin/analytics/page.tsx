import {
  CompletionDonut,
  EngagementChart,
  MetricBarChart,
} from "@/components/dashboard/charts";
import { AnalyticsCockpit } from "@/components/dashboard/analytics-cockpit";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { PageHeader } from "@/components/dashboard/page-header";
import { RiskRadarPanel } from "@/components/dashboard/content-blocks";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function AdminAnalyticsPage() {
  const data = await getDashboardData();
  const activeUsers = data.metrics.find(
    (metric) => metric.label === "Active records",
  );
  const assignmentMetric = data.metrics.find(
    (metric) => metric.label === "Assignments",
  );
  const xpMetric = data.metrics.find((metric) => metric.label === "XP events");
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
            label: xpMetric?.label ?? "XP events",
            value: xpMetric?.value ?? "0",
            meta: xpMetric?.delta ?? "Learning activity",
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
      <MetricBarChart data={signalBars} />
      <RiskRadarPanel items={data.riskSignals} />
    </div>
  );
}
