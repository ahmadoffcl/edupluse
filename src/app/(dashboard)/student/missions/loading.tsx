import { Skeleton } from "@/components/ui/skeleton";

export default function StudentMissionsLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] border border-border bg-card p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-8 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      </div>
      <div className="rounded-[1.5rem] border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-3">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-28 rounded-[1.25rem] bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
