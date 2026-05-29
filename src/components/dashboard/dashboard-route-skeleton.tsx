export function DashboardRouteSkeleton() {
  return (
    <div className="min-h-[calc(100vh-7rem)] animate-pulse space-y-4">
      <div className="rounded-[1.5rem] border border-border/70 bg-card/72 p-4 shadow-[var(--shadow-glass)]">
        <div className="h-4 w-32 rounded-full bg-muted" />
        <div className="mt-4 h-8 w-full max-w-xl rounded-full bg-muted" />
        <div className="mt-3 h-4 w-full max-w-md rounded-full bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-24 rounded-[1.35rem] border border-border/70 bg-card/72 shadow-sm sm:h-28"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <div className="h-56 rounded-[1.5rem] border border-border/70 bg-card/72 shadow-sm" />
          <div className="h-44 rounded-[1.5rem] border border-border/70 bg-card/72 shadow-sm" />
        </div>
        <div className="hidden h-80 rounded-[1.5rem] border border-border/70 bg-card/72 shadow-sm xl:block" />
      </div>
    </div>
  );
}
