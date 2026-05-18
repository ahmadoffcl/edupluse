import {
  BrainCircuit,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { assignments, notes, platformMetrics, reports } from "@/lib/mock-data";

const groups = [
  {
    title: "Learning management",
    icon: FileText,
    items: notes.map((n) => n.title),
  },
  {
    title: "Teacher workflows",
    icon: ClipboardCheck,
    items: assignments.map((a) => a.title),
  },
  {
    title: "Admin intelligence",
    icon: ShieldCheck,
    items: reports.slice(0, 3),
  },
  {
    title: "Engagement layer",
    icon: Trophy,
    items: ["XP points", "Badges", "Daily streaks"],
  },
  {
    title: "Communication",
    icon: UsersRound,
    items: ["Class chat", "Announcements", "Discussion threads"],
  },
  {
    title: "AI enhancements",
    icon: BrainCircuit,
    items: ["Study assistant", "Smart summaries", "Quiz drafts"],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PublicNavbar />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-32">
        <Badge className="mb-4">Features</Badge>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          Built for daily learning, serious administration, and delightful
          momentum.
        </h1>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <Card key={group.title}>
                <CardContent className="p-6">
                  <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <h2 className="text-xl font-semibold">{group.title}</h2>
                  <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                    {group.items.map((item) => (
                      <li key={item} className="rounded-2xl bg-muted p-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="mt-8">
          <CardContent className="grid gap-4 p-6 md:grid-cols-4">
            {platformMetrics.map((metric) => (
              <div key={metric.label}>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold">{metric.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
