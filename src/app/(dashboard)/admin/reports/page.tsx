import { FeaturePage } from "@/components/dashboard/feature-page";
import { reports } from "@/lib/mock-data";

export default function AdminReportsPage() {
  return (
    <FeaturePage
      eyebrow="Reports and exports"
      title="Generate board-ready reports from live operating data."
      description="Attendance, assignment completion, teacher activity, engagement, moderation, and intervention exports."
      action="Export CSV"
      items={reports.slice(0, 3).map((report, index) => ({
        title: report,
        meta: "Available as CSV and PDF",
        stat: index === 0 ? "Daily" : index === 1 ? "Weekly" : "Live",
        tone: index === 0 ? "success" : index === 1 ? "info" : "warning",
      }))}
    />
  );
}
