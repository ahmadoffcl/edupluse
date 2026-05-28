import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function FeaturePage({
  eyebrow,
  title,
  description,
  action,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  items: Array<{
    title: string;
    meta: string;
    stat: string;
    tone?: "default" | "success" | "warning" | "info" | "secondary";
  }>;
}) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="mb-3">{eyebrow}</Badge>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>
        </div>
        {typeof action === "string" ? null : action}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.meta}</CardDescription>
                </div>
                <Badge variant={item.tone ?? "secondary"}>{item.stat}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-28 rounded-3xl border border-border bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_16%,transparent),color-mix(in_oklab,var(--accent)_12%,transparent))]" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
