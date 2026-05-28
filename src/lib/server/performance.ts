import "server-only";

export type PerformanceInput = {
  attendancePercent: number;
  submittedPercent: number;
  averageScore: number;
  xp: number;
  missingCount: number;
  lateCount: number;
  recentActivityCount: number;
};

export type PerformanceBand = "high_momentum" | "steady" | "watch" | "at_risk";

export function engagementHeavyPerformance(input: PerformanceInput) {
  const xpScore = Math.min(100, Math.round(input.xp / 20));
  const activityScore = Math.min(100, input.recentActivityCount * 12);
  const penalty = Math.min(35, input.missingCount * 8 + input.lateCount * 4);
  const score =
    input.attendancePercent * 0.3 +
    input.submittedPercent * 0.25 +
    xpScore * 0.2 +
    activityScore * 0.15 +
    input.averageScore * 0.1 -
    penalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function performanceBand(score: number): PerformanceBand {
  if (score >= 82) return "high_momentum";
  if (score >= 62) return "steady";
  if (score >= 42) return "watch";
  return "at_risk";
}
