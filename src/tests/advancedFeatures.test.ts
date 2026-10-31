import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { detectDuplicateFiles } from '../services/fileSystem';
import { getHeuristicSuggestion } from '../services/geminiSuggest';
import { getLevelInfo, recordRunCompletion } from '../services/gamification';
import { FileItem, ItemCluster, RunSummary } from '../types';

describe('Advanced Features: Duplicate Detection, AI Fallback, and Gamification', () => {
  it('detects duplicate files by identical size and extension', () => {
    const files: FileItem[] = [
      {
        id: '1',
        name: 'Report_Final.pdf',
        path: 'Report_Final.pdf',
        size: 204850,
        lastModified: 1000,
        extension: '.pdf',
      },
      {
        id: '2',
        name: 'Report_Final (1).pdf',
        path: 'Report_Final (1).pdf',
        size: 204850,
        lastModified: 2000,
        extension: '.pdf',
      },
      {
        id: '3',
        name: 'Spreadsheet.xlsx',
        path: 'Spreadsheet.xlsx',
        size: 15400,
        lastModified: 3000,
        extension: '.xlsx',
      },
      {
        id: '4',
        name: 'Photo.jpg',
        path: 'Photo.jpg',
        size: 1024000,
        lastModified: 4000,
        extension: '.jpg',
      },
    ];

    const result = detectDuplicateFiles(files);
    expect(result.duplicateItems.length).toBe(0);
    expect(result.annotatedFiles.filter(f => f.possibleDuplicate).length).toBe(2);
    expect(result.annotatedFiles.filter(f => f.possibleDuplicate).map(f => f.name)).toContain('Report_Final.pdf');
    expect(result.annotatedFiles.filter(f => f.possibleDuplicate).map(f => f.name)).toContain('Report_Final (1).pdf');
  });

  it('provides safe, deterministic fallback suggestions when Gemini API is offline', () => {
    const tempCluster: ItemCluster = {
      id: 'c_temp',
      packType: 'file',
      key: 'pattern_temporary',
      label: 'Temporary & Lock Files',
      pattern: '*.tmp, temp_*',
      count: 4,
      totalMetric: 8000,
      exampleItems: ['cache.tmp', 'temp_build.log'],
      rawItems: [],
    };

    const tempSuggestion = getHeuristicSuggestion(tempCluster);
    expect(tempSuggestion.action).toBe('remove');
    expect(tempSuggestion.source).toBe('heuristic');
    expect(tempSuggestion.confidence).toBe('high');

    const installerCluster: ItemCluster = {
      id: 'c_inst',
      packType: 'file',
      key: 'pattern_installers',
      label: 'Application Installers',
      pattern: '*.dmg / *.exe',
      count: 2,
      totalMetric: 900000000,
      exampleItems: ['docker.dmg', 'vscode.pkg'],
      rawItems: [],
    };

    const instSuggestion = getHeuristicSuggestion(installerCluster);
    expect(instSuggestion.action).toBe('sort');
    expect(instSuggestion.destination).toBe('Installers');
    expect(instSuggestion.source).toBe('heuristic');
  });

  it('calculates correct level and progress percentage from XP', () => {
    // 0 XP -> Level 1
    const l1 = getLevelInfo(0);
    expect(l1.level).toBe(1);
    expect(l1.title).toBe('Triage Initiate');
    expect(l1.progressPercent).toBe(0);

    // 200 XP -> Level 2
    const l2 = getLevelInfo(200);
    expect(l2.level).toBe(2);
    expect(l2.title).toBe('Orderly Apprentice');
    expect(l2.progressPercent).toBeGreaterThan(0);

    // 1500 XP -> Level 5
    const l5 = getLevelInfo(1500);
    expect(l5.level).toBe(5);
    expect(l5.title).toBe('Workflow Specialist');
  });

  it('records run completion, awards XP, and unlocks achievements', async () => {
    const run: RunSummary = {
      id: `run_test_${Date.now()}`,
      packType: 'file',
      mode: 'speed_challenge',
      isSampleData: true,
      durationSeconds: 60,
      elapsedSeconds: 50,
      score: 250,
      decisionsCount: 5,
      itemsResolved: 15,
      totalBacklogItems: 20,
      decisions: [],
      timestamp: Date.now(),
    };

    const result = await recordRunCompletion(run);
    expect(result.xpEarned).toBeGreaterThan(0);
    expect(result.updatedStats.totalRunsCompleted).toBeGreaterThanOrEqual(1);
    expect(result.updatedStats.unlockedAchievements).toContain('first_sort');
    expect(result.updatedStats.unlockedAchievements).toContain('speed_demon');
  });
});
