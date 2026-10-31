import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
  saveApplyLog,
  getApplyLogs,
  getLastActiveApplyLog,
  markApplyLogReverted,
  clearAllLocalData,
} from '../services/db';
import { ApplyLog } from '../types';

describe('Undo Log & Apply History', () => {
  it('saves apply logs and retrieves them in reverse chronological order', async () => {
    await clearAllLocalData();

    const log1: ApplyLog = {
      id: 'log_1',
      timestamp: 1000,
      packType: 'file',
      totalItems: 5,
      summary: 'Moved 5 files',
      items: [],
      operations: [
        {
          id: 'op1',
          type: 'file_move',
          sourceName: 'screenshot.png',
          destFolder: 'Images',
          reverted: false,
        },
      ],
      reverted: false,
    };

    const log2: ApplyLog = {
      id: 'log_2',
      timestamp: 2000,
      packType: 'expense',
      totalItems: 8,
      summary: 'Categorized 8 transactions',
      items: [],
      operations: [],
      reverted: false,
    };

    await saveApplyLog(log1);
    await saveApplyLog(log2);

    const logs = await getApplyLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].id).toBe('log_2'); // most recent first
    expect(logs[1].id).toBe('log_1');

    // Last active apply log should be log2
    const lastActive = await getLastActiveApplyLog();
    expect(lastActive?.id).toBe('log_2');
  });

  it('marks an apply log as reverted and updates last active apply log', async () => {
    await markApplyLogReverted('log_2');

    const lastActiveAfterRevert = await getLastActiveApplyLog();
    expect(lastActiveAfterRevert?.id).toBe('log_1');

    const logs = await getApplyLogs();
    const revertedLog = logs.find((l) => l.id === 'log_2');
    expect(revertedLog?.reverted).toBe(true);
    expect(revertedLog?.revertedAt).toBeDefined();
  });
});
