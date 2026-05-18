import {
  GamificationPanel,
  LeaderboardPanel,
} from "@/components/dashboard/content-blocks";
import { PageHeader } from "@/components/dashboard/page-header";
import { getDashboardData } from "@/lib/dashboard/server-data";

export default async function StudentLeaderboardPage() {
  const data = await getDashboardData();

  return (
    <div>
      <PageHeader
        eyebrow="Leaderboard"
        title="XP, badges, streaks, and milestones."
        description="Gamification is designed to reward consistency and mastery without making learning feel childish."
      />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <GamificationPanel
          totalXp={data.totalXp}
          streak={data.leaderboard[0]?.streak ?? 0}
        />
        <LeaderboardPanel items={data.leaderboard} />
      </div>
    </div>
  );
}
