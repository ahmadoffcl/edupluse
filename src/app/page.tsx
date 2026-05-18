import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarCheck2,
  ChartNoAxesCombined,
  CheckCircle2,
  ClipboardCheck,
  Layers3,
  LineChart,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CompletionDonut,
  EngagementChart,
} from "@/components/dashboard/charts";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import {
  analytics,
  assignments,
  platformMetrics,
  riskSignals,
} from "@/lib/mock-data";

const features = [
  {
    icon: BrainCircuit,
    title: "AI-supported learning",
    text: "Study assistant, summaries, and quiz drafts with organization-aware guardrails.",
  },
  {
    icon: CalendarCheck2,
    title: "Unified classroom operations",
    text: "Assignments, attendance, notes, schedules, exams, and class resources in one flow.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Enterprise analytics",
    text: "Engagement, completion, teacher activity, attendance, and intervention signals.",
  },
  {
    icon: MessageSquareText,
    title: "Social-style collaboration",
    text: "Class channels, discussions, announcements, messages, and achievement activity.",
  },
];

const heroStats = [
  { label: "Organizations", value: "64" },
  { label: "Live classes", value: "312" },
  { label: "AI drafts", value: "8.7k" },
  { label: "Tasks routed", value: "42k" },
];

const commandItems = [
  {
    icon: BookOpenCheck,
    title: "Physics 10-A",
    meta: "Momentum lab starts in 12 min",
    tone: "text-primary bg-primary/12",
  },
  {
    icon: ClipboardCheck,
    title: "Assignment queue",
    meta: "184 submissions ready for review",
    tone: "text-blue-500 bg-blue-500/12",
  },
  {
    icon: ShieldCheck,
    title: "Role gates",
    meta: "Student, teacher, and admin access verified",
    tone: "text-emerald-500 bg-emerald-500/12",
  },
];

const operatingModel = [
  {
    icon: UsersRound,
    title: "Multi-role workspaces",
    text: "Purpose-built dashboards for students, teachers, admins, and platform owners.",
  },
  {
    icon: Layers3,
    title: "Tenant-ready foundation",
    text: "Organizations, memberships, role claims, secure sessions, and scoped data paths.",
  },
  {
    icon: Trophy,
    title: "Motivation without clutter",
    text: "XP, streaks, badges, and leaderboards that support serious learning habits.",
  },
];

const launchFlow = [
  "Invite learners and staff",
  "Publish classes and resources",
  "Track attendance and assignments",
  "Trigger AI-supported interventions",
];

const engagementPreview = analytics.map(({ label, engagement }) => ({
  label,
  engagement,
}));

const assignmentTotal = assignments.length || 1;
const assignmentStatus = [
  {
    name: "Submitted",
    value: Math.round(
      (assignments.filter((item) => item.status === "submitted").length /
        assignmentTotal) *
        100,
    ),
  },
  {
    name: "Graded",
    value: Math.round(
      (assignments.filter((item) => item.status === "graded").length /
        assignmentTotal) *
        100,
    ),
  },
  {
    name: "Pending",
    value: Math.round(
      (assignments.filter((item) => item.status === "pending").length /
        assignmentTotal) *
        100,
    ),
  },
].filter((item) => item.value > 0);

export default function Home() {
  return (
    <>
      <PublicNavbar />
      <main className="overflow-hidden">
        <section className="relative px-4 pb-14 pt-28 md:pt-32">
          <div className="premium-grid pointer-events-none absolute inset-x-0 top-0 h-[560px]" />
          <div className="mx-auto grid min-h-[calc(100vh-7rem)] max-w-7xl items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="relative z-10">
              <Badge className="mb-5">
                <Sparkles className="size-3" />
                Education operations, learning, and AI in one workspace
              </Badge>
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">
                EduPulse
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                A polished multi-tenant platform for schools, academies,
                coaching centers, and online classes, built around daily
                learning workflows, collaboration, analytics, gamification, and
                practical AI support.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="premium" size="lg">
                  <Link href="/login">
                    Open workspace <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/features">Explore features</Link>
                </Button>
              </div>
              <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                {heroStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-border bg-card/70 p-4"
                  >
                    <p className="text-2xl font-semibold tracking-tight">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 grid gap-4">
              <div className="glass-panel rounded-[2rem] p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <BrandLogo textClassName="text-lg" />
                  <Badge variant="success">Live school day</Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {platformMetrics.slice(0, 4).map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-3xl border border-border bg-background/55 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {metric.label}
                          </p>
                          <p className="mt-2 text-3xl font-semibold tracking-tight">
                            {metric.value}
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
                          {metric.delta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_260px]">
                  <div className="rounded-3xl border border-border bg-background/60 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Command queue
                        </p>
                        <p className="font-semibold">Next best actions</p>
                      </div>
                      <LineChart className="size-5 text-primary" />
                    </div>
                    <div className="space-y-3">
                      {commandItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.title}
                            className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3"
                          >
                            <span
                              className={`grid size-10 place-items-center rounded-2xl ${item.tone}`}
                            >
                              <Icon className="size-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">
                                {item.title}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {item.meta}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-border bg-background/60 p-4">
                    <p className="text-sm text-muted-foreground">
                      Intervention radar
                    </p>
                    <p className="mt-1 text-2xl font-semibold">118</p>
                    <div className="mt-4 space-y-3">
                      {riskSignals.slice(0, 3).map((signal) => (
                        <div key={signal.label}>
                          <div className="mb-1 flex justify-between gap-3 text-xs">
                            <span className="truncate text-muted-foreground">
                              {signal.label}
                            </span>
                            <span className="font-semibold">
                              {signal.count}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${Math.min(signal.count, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[0.7fr_1fr] lg:items-end">
              <div>
                <Badge className="mb-3">Platform modules</Badge>
                <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                  A complete school operating system with a learning heart.
                </h2>
              </div>
              <p className="max-w-2xl text-muted-foreground lg:justify-self-end">
                EduPulse keeps high-frequency school work close to the surface:
                lessons, submissions, attendance, messages, AI drafts, and
                intervention signals all stay visible without feeling noisy.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={feature.title}
                    className="motion-safe hover:-translate-y-1"
                  >
                    <CardContent className="p-6">
                      <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
                        <Icon className="size-6" />
                      </div>
                      <h3 className="text-lg font-semibold">{feature.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {feature.text}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <Badge className="mb-3">Live preview</Badge>
                <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                  Analytics that explain what to do next.
                </h2>
              </div>
              <Button asChild variant="outline">
                <Link href="/login">
                  Try the workspace <ArrowRight />
                </Link>
              </Button>
            </div>
            <MetricGrid metrics={platformMetrics} />
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
              <EngagementChart data={engagementPreview} />
              <CompletionDonut data={assignmentStatus} />
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardContent className="p-6 md:p-8">
                <Badge className="mb-4">Launch model</Badge>
                <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
                  From setup to intervention in one connected flow.
                </h2>
                <div className="mt-8 grid gap-3">
                  {launchFlow.map((step, index) => (
                    <div
                      key={step}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-background/55 p-4"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-primary/12 font-mono text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span className="font-medium">{step}</span>
                      <CheckCircle2 className="ml-auto size-5 text-emerald-500" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              {operatingModel.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title}>
                    <CardContent className="p-6">
                      <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
                        <Icon className="size-6" />
                      </div>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {item.text}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
              <Card className="md:col-span-3">
                <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <Badge className="mb-3">
                      <Rocket className="size-3" />
                      Ready for serious rollout
                    </Badge>
                    <h3 className="text-2xl font-semibold tracking-tight">
                      Start with your institute workspace, then shape every
                      class, role, and workflow around your team.
                    </h3>
                  </div>
                  <Button asChild variant="premium" size="lg">
                    <Link href="/signup">
                      Create account <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
