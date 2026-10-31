/**
 * Core type definitions for Sortie
 */

export type PackType = 'file' | 'expense';

export type DecisionAction = 'keep' | 'remove' | 'sort' | 'skip';

export type GameMode = 'smart_cleanup' | 'speed_challenge';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number; // in bytes
  lastModified: number;
  extension: string;
  handle?: FileSystemFileHandle;
  relativeDepth?: number;
  isDuplicate?: boolean;
  possibleDuplicate?: boolean;
  duplicateGroupKey?: string;
}

export interface ExpenseItem {
  id: string;
  date: string;
  description: string;
  normalizedMerchant: string;
  amount: number;
  category?: string;
  isCreditOrRefund?: boolean;
  rawRecord?: Record<string, string>;
}

export interface RecurringCadence {
  isRecurring: boolean;
  count: number;
  averageIntervalDays: number;
  isSubscription?: boolean;
}

export interface AiStructuredSuggestion {
  id: string;
  action: 'keep' | 'remove' | 'sort' | 'review';
  category?: string;
  destination?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  riskLevel: 'low' | 'medium' | 'high';
  needsHumanReview: boolean;
  source: 'gemini' | 'heuristic';
}

export interface ItemCluster {
  id: string;
  packType: PackType;
  key: string; // e.g. extension ".png" or merchant name "Uber"
  label: string;
  pattern: string;
  count: number;
  totalMetric: number; // total bytes for files, total amount for expenses
  firstDate?: number | string;
  lastDate?: number | string;
  exampleItems: string[]; // exactly 3 examples (or all if < 3)
  rawItems: (FileItem | ExpenseItem)[];
  recurringInfo?: RecurringCadence;
  isIncomeAndRefunds?: boolean;
  isDuplicateCluster?: boolean;
  suggestion?: {
    action: 'keep' | 'remove' | 'sort' | 'review';
    destination?: string;
    reason?: string;
    confidence?: 'high' | 'medium' | 'low';
    riskLevel?: 'low' | 'medium' | 'high';
    needsHumanReview?: boolean;
    source?: 'gemini' | 'heuristic';
  };
}

export interface DecisionRecord {
  clusterId: string;
  clusterKey: string;
  packType: PackType;
  action: DecisionAction;
  destination?: string;
  timestamp: number;
  durationMs: number;
  pointsAwarded: number;
  comboAtDecision: number;
  itemsCount: number;
  clusterLabel: string;
  clusterMetric: number;
  items: (FileItem | ExpenseItem)[];
  source?: 'user' | 'rule';
  wasAiAccepted?: boolean;
}

export interface LocalRule {
  id: string;
  packType: PackType;
  pattern: string;
  matchType: 'extension' | 'name_prefix' | 'merchant_exact' | 'merchant_contains';
  action: 'keep' | 'remove' | 'sort';
  destination?: string;
  createdAt: number;
  description?: string;
  timesApplied?: number;
}

export interface PlanItem {
  id: string;
  clusterId: string;
  packType: PackType;
  clusterLabel: string;
  action: 'keep' | 'remove' | 'sort';
  destination?: string;
  itemsCount: number;
  metricTotal: number;
  items: (FileItem | ExpenseItem)[];
  selected: boolean;
  source?: 'user' | 'rule';
  isIncomeAndRefunds?: boolean;
  isDuplicateCluster?: boolean;
}

export interface AppliedOperation {
  id: string;
  type: 'file_move' | 'expense_categorize';
  sourceName?: string;
  sourcePath?: string;
  destFolder?: string;
  resolvedName?: string;
  expenseId?: string;
  assignedCategory?: string;
  reverted: boolean;
}

export interface ApplyLog {
  id: string;
  timestamp: number;
  packType: PackType;
  totalItems: number;
  summary: string;
  items: PlanItem[];
  operations: AppliedOperation[];
  reverted: boolean;
  revertedAt?: number;
}

export interface RunSummary {
  id: string;
  packType: PackType;
  mode: GameMode;
  isSampleData: boolean;
  durationSeconds: number;
  elapsedSeconds: number;
  score: number;
  decisionsCount: number;
  itemsResolved: number;
  totalBacklogItems: number;
  decisions: DecisionRecord[];
  timestamp: number;
  xpEarned?: number;
}

export interface CSVColumnMapping {
  dateCol: string;
  descriptionCol: string;
  amountCol: string;
  debitCol?: string;
  creditCol?: string;
}

export interface FolderScanOptions {
  recursive: boolean;
  maxDepth: number;
  excludeHidden: boolean;
  ignoredPatterns: string[];
}

export interface UserStats {
  totalDecisions: number;
  totalItemsOrganized: number;
  totalFilesProcessed: number;
  totalBytesProcessed: number;
  totalExpensesCategorized: number;
  totalRunsCompleted: number;
  xp: number;
  level: number;
  currentStreakDays: number;
  lastActiveDate: string;
  unlockedAchievements: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requiredXp?: number;
}
