import { PublicNavbar } from "@/components/layout/public-navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const audience = [
  [
    "For students",
    "A simple daily home for classes, upcoming work, notes, submissions, and progress.",
  ],
  [
    "For teachers",
    "A Google Classroom-style workflow for posting, assigning, sharing, and reviewing work.",
  ],
  [
    "For admins",
    "A controlled institute workspace for creating IDs, managing users, and keeping access clean.",
  ],
];

const principles = [
  "Real activity instead of fake dashboard noise",
  "Simple workflows before complex configuration",
  "Secure role-based access for every page and action",
  "Premium UI that still feels easy for first-time users",
];

export default function AboutPage() {
  return (
    <>
      <PublicNavbar />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-32">
        <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <Badge className="mb-4">About EduPulse</Badge>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Built around the everyday rhythm of a real class.
            </h1>
          </div>
          <p className="text-lg leading-8 text-muted-foreground">
            EduPulse is designed for schools, academies, coaching centers, and
            online classes that need one friendly place for learning work,
            classroom communication, and institute control.
          </p>
        </section>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {audience.map(([title, text]) => (
            <Card key={title}>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardContent className="p-6 md:p-8">
              <Badge className="mb-4">Product belief</Badge>
              <h2 className="text-3xl font-semibold tracking-tight">
                Learning software should be clear enough for daily use and
                strong enough for serious institutions.
              </h2>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-3 p-6 md:grid-cols-2 md:p-8">
              {principles.map((item) => (
                <div
                  key={item}
                  className="rounded-3xl border border-border bg-background/60 p-4 text-sm font-medium leading-6"
                >
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
