import { UserStats, Achievement, RunSummary } from '../types';
import { getSetting, setSetting } from './db';

const STATS_STORAGE_KEY = 'sortie_user_stats';

export const ACHIEVEMENTS_LIST: Achievement[] = [
  {
    id: 'first_sort',
    title: 'First Clean Sweep',
    description: 'Complete your first digital triage session.',
    icon: 'Sparkles',
  },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Finish a Speed Challenge run with over 200 points.',
    icon: 'Zap',
  },
  {
    id: 'rule_maker',
    title: 'Rule Architect',
    description: 'Save a reusable sorting rule to automate future scans.',
    icon: 'Sliders',
  },
  {
    id: 'duplicate_hunter',
    title: 'Duplicate Slayer',
    description: 'Identify and resolve a cluster of duplicate files.',
    icon: 'Copy',
  },
  {
    id: 'streak_3',
    title: 'Habit Builder',
    description: 'Maintain a 3-day active digital organization streak.',
    icon: 'Flame',
  },
  {
    id: 'hundred_club',
    title: 'Century Sorter',
    description: 'Organize or review over 100 digital files or transactions.',
    icon: 'Award',
  },
];

const INITIAL_STATS: UserStats = {
  totalDecisions: 0,
  totalItemsOrganized: 0,
  totalFilesProcessed: 0,
  totalBytesProcessed: 0,
  totalExpensesCategorized: 0,
  totalRunsCompleted: 0,
  xp: 0,
  level: 1,
  currentStreakDays: 1,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  unlockedAchievements: [],
};

export function getLevelInfo(xp: number): {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
} {
  // Level curve: 0-150: Lv 1, 150-400: Lv 2, 400-800: Lv 3, etc.
  const levels = [
    { level: 1, minXp: 0, maxXp: 150, title: 'Triage Initiate' },
    { level: 2, minXp: 150, maxXp: 400, title: 'Orderly Apprentice' },
    { level: 3, minXp: 400, maxXp: 800, title: 'Clutter Crusader' },
    { level: 4, minXp: 800, maxXp: 1400, title: 'Digital Archivist' },
    { level: 5, minXp: 1400, maxXp: 2200, title: 'Workflow Specialist' },
    { level: 6, minXp: 2200, maxXp: 3500, title: 'Declutter Grandmaster' },
  ];

  let current = levels[0];
  for (const l of levels) {
    if (xp >= l.minXp) {
      current = l;
    }
  }

  const range = current.maxXp - current.minXp;
  const progressInLevel = Math.max(0, xp - current.minXp);
  const progressPercent = Math.min(100, Math.round((progressInLevel / range) * 100));

  return {
    level: current.level,
    title: current.title,
    currentLevelXp: progressInLevel,
    nextLevelXp: range,
    progressPercent,
  };
}

export async function getUserStats(): Promise<UserStats> {
  const stored = await getSetting<UserStats>(STATS_STORAGE_KEY, INITIAL_STATS);
  // Ensure all keys exist
  return {
    ...INITIAL_STATS,
    ...stored,
    level: getLevelInfo(stored?.xp || 0).level,
  };
}

export async function recordRunCompletion(run: RunSummary): Promise<{
  updatedStats: UserStats;
  newAchievements: Achievement[];
  xpEarned: number;
}> {
  const stats = await getUserStats();
  const today = new Date().toISOString().slice(0, 10);

  // Compute XP earned from this run
  let xpEarned = 50; // Completion base
  xpEarned += run.itemsResolved * 5;
  if (run.mode === 'speed_challenge' && run.score > 100) {
    xpEarned += Math.floor(run.score / 5);
  }

  // Update streak
  let newStreak = stats.currentStreakDays;
  if (stats.lastActiveDate !== today) {
    const lastDate = new Date(stats.lastActiveDate);
    const currentDate = new Date(today);
    const diffDays = Math.round(
      (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  }

  const totalDecisions = stats.totalDecisions + run.decisionsCount;
  const totalItemsOrganized = stats.totalItemsOrganized + run.itemsResolved;
  const totalRunsCompleted = stats.totalRunsCompleted + 1;
  const newXp = stats.xp + xpEarned;
  const levelInfo = getLevelInfo(newXp);

  const updatedStats: UserStats = {
    ...stats,
    totalDecisions,
    totalItemsOrganized,
    totalRunsCompleted,
    totalFilesProcessed:
      stats.totalFilesProcessed + (run.packType === 'file' ? run.itemsResolved : 0),
    totalExpensesCategorized:
      stats.totalExpensesCategorized + (run.packType === 'expense' ? run.itemsResolved : 0),
    xp: newXp,
    level: levelInfo.level,
    currentStreakDays: newStreak,
    lastActiveDate: today,
  };

  // Check new achievements
  const newAchievements: Achievement[] = [];
  const currentUnlocked = new Set(stats.unlockedAchievements || []);

  const checkUnlock = (id: string, condition: boolean) => {
    if (condition && !currentUnlocked.has(id)) {
      currentUnlocked.add(id);
      const ach = ACHIEVEMENTS_LIST.find((a) => a.id === id);
      if (ach) newAchievements.push(ach);
    }
  };

  checkUnlock('first_sort', totalRunsCompleted >= 1);
  checkUnlock('speed_demon', run.mode === 'speed_challenge' && run.score >= 200);
  checkUnlock('streak_3', newStreak >= 3);
  checkUnlock('hundred_club', totalItemsOrganized >= 100);

  // Check if any duplicate cluster was resolved
  const hasDuplicates = run.decisions.some(
    (d) => (d as any).isDuplicateCluster || d.clusterKey.includes('duplicate')
  );
  checkUnlock('duplicate_hunter', hasDuplicates);

  updatedStats.unlockedAchievements = Array.from(currentUnlocked);
  await setSetting(STATS_STORAGE_KEY, updatedStats);

  return {
    updatedStats,
    newAchievements,
    xpEarned,
  };
}

export async function recordRuleCreated(): Promise<{
  newAchievements: Achievement[];
  xpEarned: number;
}> {
  const stats = await getUserStats();
  const xpEarned = 40;
  const newXp = stats.xp + xpEarned;

  const currentUnlocked = new Set(stats.unlockedAchievements || []);
  const newAchievements: Achievement[] = [];

  if (!currentUnlocked.has('rule_maker')) {
    currentUnlocked.add('rule_maker');
    const ach = ACHIEVEMENTS_LIST.find((a) => a.id === 'rule_maker');
    if (ach) newAchievements.push(ach);
  }

  const updatedStats: UserStats = {
    ...stats,
    xp: newXp,
    level: getLevelInfo(newXp).level,
    unlockedAchievements: Array.from(currentUnlocked),
  };

  await setSetting(STATS_STORAGE_KEY, updatedStats);
  return { newAchievements, xpEarned };
}
