import { describe, it, expect } from 'vitest';
import {
  calculateDecisionScore,
  getNextCombo,
  getCurrentComboMultiplier,
  SCORE_FORMULA_TEXT,
  MAX_COMBO,
  UNDO_TIME_PENALTY_SECONDS,
} from '../utils/scoring';

describe('Scoring & Combo Mechanics', () => {
  it('displays the exact scoring formula', () => {
    expect(SCORE_FORMULA_TEXT).toBe('Every reviewed decision = 10 + items pts (regardless of action)');
  });

  it('keeps score flat 10 with no cluster size bonus or combo multiplier', () => {
    // 0 items, combo 1 => 10
    expect(calculateDecisionScore(0, 1, 'keep')).toBe(10);
    // 5 items, combo 3 => 10
    expect(calculateDecisionScore(5, 3, 'keep')).toBe(15);
    // 50 items, combo 5 => 10
    expect(calculateDecisionScore(50, 5, 'keep')).toBe(60);
  });

  it('calculates remove and sort score according to formula: (10 + items in cluster) x combo', () => {
    // 0 items, combo 1 => (10 + 0) * 1 = 10
    expect(calculateDecisionScore(0, 1, 'remove')).toBe(10);

    // 5 items, combo 1 => (10 + 5) * 1 = 15
    expect(calculateDecisionScore(5, 1, 'remove')).toBe(15);

    // 12 items, combo 3 => (10 + 12) * 3 = 66
    expect(calculateDecisionScore(12, 3, 'sort')).toBe(22);

    // 25 items, combo 5 => (10 + 25) * 5 = 175
    expect(calculateDecisionScore(25, 5, 'sort')).toBe(35);
  });

  it('awards 0 points on skip', () => {
    expect(calculateDecisionScore(15, 3, 'skip')).toBe(0);
    expect(calculateDecisionScore(0, 1, 'skip')).toBe(0);
  });

  it('combo rises by 1 for quick decisions made within 2000ms', () => {
    expect(getNextCombo(1, 800, 'keep')).toBe(2);
    expect(getNextCombo(2, 1950, 'remove')).toBe(3);
    expect(getNextCombo(3, 400, 'sort')).toBe(4);
    expect(getNextCombo(4, 1500, 'keep')).toBe(5);
  });

  it('caps combo at maximum x5', () => {
    expect(getNextCombo(5, 500, 'keep')).toBe(MAX_COMBO);
    expect(getNextCombo(5, 1200, 'sort')).toBe(MAX_COMBO);
  });

  it('resets combo to 1 on slow decisions exceeding 2000ms', () => {
    expect(getNextCombo(4, 2001, 'keep')).toBe(1);
    expect(getNextCombo(5, 3500, 'remove')).toBe(1);
  });

  it('resets combo to 1 on a skip decision even if fast', () => {
    expect(getNextCombo(3, 400, 'skip')).toBe(1);
    expect(getNextCombo(5, 800, 'skip')).toBe(1);
  });

  it('clamps combo multiplier cleanly between 1 and 5', () => {
    expect(getCurrentComboMultiplier(0)).toBe(1);
    expect(getCurrentComboMultiplier(-2)).toBe(1);
    expect(getCurrentComboMultiplier(4)).toBe(4);
    expect(getCurrentComboMultiplier(99)).toBe(5);
  });

  it('defines 3 second undo penalty', () => {
    expect(UNDO_TIME_PENALTY_SECONDS).toBe(3);
  });
});
