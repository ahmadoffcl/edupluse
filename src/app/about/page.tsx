import { PublicNavbar } from "@/components/layout/public-navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <>
      <PublicNavbar />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-32">
        <Badge className="mb-4">About</Badge>
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          EduPulse turns the daily rhythm of education into a premium,
          motivating product experience.
        </h1>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["Schools", "Attendance, classes, sections, exams, announcements."],
            ["Academies", "Batches, coaching workflows, resources, analytics."],
            [
              "Online classes",
              "Realtime messages, uploads, AI help, schedules.",
            ],
          ].map(([title, text]) => (
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
      </main>
    </>
  );
}
