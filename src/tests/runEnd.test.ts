import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveCurrentPlan,
  getCurrentPlan,
  clearPlan,
  clearAllLocalData,
} from '../services/db';
import { DecisionRecord, PlanItem } from '../types';

describe('Run End & Plan Building on Timer Expiry', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it('saves real decisions to plan when timer runs out after 3 decisions', async () => {
    // Simulate user making 3 decisions during a timed run
    const decisions: DecisionRecord[] = [
      {
        clusterId: 'c1',
        clusterKey: 'pattern_screenshot',
        packType: 'file',
        action: 'remove',
        timestamp: 1000,
        durationMs: 900,
        pointsAwarded: 24,
        comboAtDecision: 1,
        itemsCount: 2,
        clusterLabel: 'Screenshots',
        clusterMetric: 500000,
        items: [],
        source: 'user',
      },
      {
        clusterId: 'c2',
        clusterKey: 'pattern_installers',
        packType: 'file',
        action: 'sort',
        destination: 'Installers',
        timestamp: 2100,
        durationMs: 1100,
        pointsAwarded: 36,
        comboAtDecision: 2,
        itemsCount: 4,
        clusterLabel: 'Application Installers',
        clusterMetric: 120000000,
        items: [],
        source: 'user',
      },
      {
        clusterId: 'c3',
        clusterKey: 'pattern_documents',
        packType: 'file',
        action: 'keep',
        timestamp: 3500,
        durationMs: 1400,
        pointsAwarded: 60,
        comboAtDecision: 3,
        itemsCount: 5,
        clusterLabel: 'PDF Documents',
        clusterMetric: 8000000,
        items: [],
        source: 'user',
      },
    ];

    // Timer expiry triggers conversion of all recorded decisions into PlanItem objects
    const planItems: PlanItem[] = decisions
      .filter((d) => d.action !== 'skip')
      .map((d) => ({
        id: `plan_${d.clusterId}_test`,
        clusterId: d.clusterId,
        packType: d.packType,
        clusterLabel: d.clusterLabel,
        action: d.action as 'keep' | 'remove' | 'sort',
        destination: d.destination,
        itemsCount: d.itemsCount,
        metricTotal: d.clusterMetric,
        items: d.items,
        selected: d.action !== 'keep',
        source: d.source || 'user',
      }));

    await saveCurrentPlan(planItems);

    const savedPlan = await getCurrentPlan();
    expect(savedPlan.length).toBe(3);
    expect(savedPlan[0].clusterLabel).toBe('Screenshots');
    expect(savedPlan[0].action).toBe('remove');
    expect(savedPlan[1].clusterLabel).toBe('Application Installers');
    expect(savedPlan[1].action).toBe('sort');
    expect(savedPlan[1].destination).toBe('Installers');
    expect(savedPlan[2].clusterLabel).toBe('PDF Documents');
    expect(savedPlan[2].action).toBe('keep');
  });

  it('includes final card decision in the plan', async () => {
    const decisions: DecisionRecord[] = [
      {
        clusterId: 'c_final',
        clusterKey: 'ext_zip',
        packType: 'file',
        action: 'sort',
        destination: 'Archives',
        timestamp: 5000,
        durationMs: 800,
        pointsAwarded: 13,
        comboAtDecision: 1,
        itemsCount: 3,
        clusterLabel: 'Compressed Archives',
        clusterMetric: 100000,
        items: [],
        source: 'user',
      },
    ];

    const planItems: PlanItem[] = decisions.map((d) => ({
      id: `plan_${d.clusterId}`,
      clusterId: d.clusterId,
      packType: d.packType,
      clusterLabel: d.clusterLabel,
      action: d.action as 'keep' | 'remove' | 'sort',
      destination: d.destination,
      itemsCount: d.itemsCount,
      metricTotal: d.clusterMetric,
      items: d.items,
      selected: true,
      source: 'user',
    }));

    await saveCurrentPlan(planItems);
    const plan = await getCurrentPlan();
    expect(plan.length).toBe(1);
    expect(plan[0].clusterLabel).toBe('Compressed Archives');
  });
});
