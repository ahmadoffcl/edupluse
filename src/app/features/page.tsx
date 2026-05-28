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

const groups = [
  {
    title: "Learning management",
    icon: FileText,
    items: [
      "Classrooms with stream, classwork, materials, and people",
      "Assignment deadlines with student submissions",
      "Teacher resources, links, notes, and files",
    ],
  },
  {
    title: "Teacher workflows",
    icon: ClipboardCheck,
    items: [
      "Create classes and add real students",
      "Publish assignments with attachments",
      "Grade submissions and return feedback",
    ],
  },
  {
    title: "Admin intelligence",
    icon: ShieldCheck,
    items: [
      "Create student and teacher IDs",
      "Manage users, roles, and invitations",
      "Track live institute activity",
    ],
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
        <section className="grid gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-end">
          <div>
            <Badge className="mb-4">Features</Badge>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
              A clean classroom experience with serious power underneath.
            </h1>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
            EduPulse brings classroom posts, tasks, materials, users, and AI
            support into one calm interface for students, teachers, and admins.
          </p>
        </section>
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
            {[
              ["Student hub", "Classes, tasks, materials"],
              ["Teacher studio", "Create, post, grade"],
              ["Admin control", "Users, roles, invites"],
              ["Secure access", "Role-gated workflows"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
