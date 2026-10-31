import { DecisionAction } from '../types';

export const SCORE_FORMULA_TEXT = 'Every reviewed decision = 10 + items pts (regardless of action)';
export const QUICK_DECISION_THRESHOLD_MS = 2000;
export const MAX_COMBO = 5;
export const UNDO_TIME_PENALTY_SECONDS = 3;

/**
 * Calculates score awarded for resolving a cluster.
 * Keep scores a flat 10 with no cluster-size bonus.
 * Remove and Sort score (10 + items in cluster) x combo.
 * Skip scores 0.
 */
export function calculateDecisionScore(
  itemsInCluster: number,
  combo: number,
  action: DecisionAction
): number {
  if (action === 'skip') return 0;
  return 10 + Math.max(0, itemsInCluster);
}

/**
 * Computes next combo multiplier based on decision duration and action.
 * Combo rises by 1 for each decision made within 2 seconds of the card appearing (max x5).
 * Resets to 1 on a skip or a slow decision (> 2 seconds).
 */
export function getNextCombo(
  currentCombo: number,
  durationMs: number,
  action: DecisionAction
): number {
  if (action === 'skip') {
    return 1;
  }

  // Decision within 2000ms rises combo by 1, up to max 5
  if (durationMs <= QUICK_DECISION_THRESHOLD_MS) {
    return Math.min(MAX_COMBO, currentCombo + 1);
  }

  // Slow decision resets combo
  return 1;
}

/**
 * Returns combo multiplier for the current decision before incrementing.
 */
export function getCurrentComboMultiplier(combo: number): number {
  return Math.max(1, Math.min(MAX_COMBO, combo));
}
