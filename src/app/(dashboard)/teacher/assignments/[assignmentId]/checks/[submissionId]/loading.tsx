import { Skeleton } from "@/components/ui/skeleton";

export default function TeacherAssignmentChecksLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] border border-border bg-card p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-8 w-80 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-40 rounded-[1.5rem]" />
      <div className="grid gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-[1.5rem]" />
    </div>
  );
}
