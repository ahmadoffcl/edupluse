export type StreakInput = {
  activeDates: string[];
  today?: string;
};

function toLocalDate(value: string | Date) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateLevel(totalXp: number) {
  const level = Math.max(1, Math.floor(Math.sqrt(totalXp / 120)) + 1);
  const currentLevelStart = Math.pow(level - 1, 2) * 120;
  const nextLevelStart = Math.pow(level, 2) * 120;
  const progress =
    ((totalXp - currentLevelStart) / (nextLevelStart - currentLevelStart)) *
    100;

  return {
    level,
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    nextLevelXp: nextLevelStart,
    remainingXp: Math.max(0, nextLevelStart - totalXp),
  };
}

export function calculateStreak({ activeDates, today }: StreakInput) {
  const normalized = new Set(
    activeDates.map((date) => dateKey(toLocalDate(date))),
  );
  const cursor = today ? toLocalDate(today) : toLocalDate(new Date());

  let streak = 0;
  while (normalized.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function awardXpForAction(action: string) {
  const points: Record<string, number> = {
    assignment_submitted: 120,
    perfect_attendance_day: 60,
    note_reviewed: 35,
    challenge_completed: 180,
    discussion_helpful: 45,
  };

  return points[action] ?? 10;
}
