import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Badge variant="default" className="mb-2 text-[11px] sm:text-xs">
          {eyebrow}
        </Badge>
        <h1 className="max-w-4xl text-xl font-semibold leading-tight tracking-tight sm:text-2xl md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
