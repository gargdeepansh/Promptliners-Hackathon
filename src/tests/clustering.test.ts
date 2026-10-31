import { describe, it, expect } from 'vitest';
import {
  clusterFiles,
  clusterExpenses,
  normalizeMerchant,
  matchRule,
  parseAmount,
} from '../utils/clustering';
import { FileItem, ExpenseItem, LocalRule } from '../types';

describe('Clustering & Merchant Normalization', () => {
  it('parses amounts with currency symbols, Indian/Western commas, negatives, and parentheses', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('₹1,23,456.00')).toBe(123456.00);
    expect(parseAmount('(45.10)')).toBe(-45.10);
    expect(parseAmount('-45.10')).toBe(-45.10);
    expect(parseAmount('$1,234.56')).toBe(1234.56);
    expect(parseAmount('€ 500.00')).toBe(500.00);
    expect(parseAmount('£99.99')).toBe(99.99);
    expect(parseAmount(' (1,234.56) ')).toBe(-1234.56);
    expect(parseAmount(45.1)).toBe(45.1);
    expect(parseAmount('')).toBe(0);
  });

  it('normalizes noisy merchant transaction strings into clean brand names', () => {
    expect(normalizeMerchant('UBER *TRIP 9812 SAN FRANCISCO CA')).toBe('Uber');
    expect(normalizeMerchant('AMZN MKTP US*1J209A SEATTLE WA')).toBe('Amazon');
    expect(normalizeMerchant('STARBUCKS STORE #10492 SAN FRANCISCO CA')).toBe('Starbucks');
    expect(normalizeMerchant('WHOLEFDS SFO 10293 SAN FRANCISCO CA')).toBe('Whole Foods');
    expect(normalizeMerchant('NETFLIX.COM 866-579-7172 CA')).toBe('Netflix');
  });

  it('ensures template_contract.pdf and temperature_report.pdf do NOT land in temporary group', () => {
    const files: FileItem[] = [
      {
        id: '1',
        name: 'template_contract.pdf',
        path: 'template_contract.pdf',
        size: 50000,
        lastModified: 1726000000000,
        extension: '.pdf',
      },
      {
        id: '2',
        name: 'temperature_report.pdf',
        path: 'temperature_report.pdf',
        size: 80000,
        lastModified: 1726000000000,
        extension: '.pdf',
      },
      {
        id: '3',
        name: 'temp_cache.bin',
        path: 'temp_cache.bin',
        size: 1024,
        lastModified: 1726000000000,
        extension: '.bin',
      },
      {
        id: '4',
        name: 'tmp_session.dat',
        path: 'tmp_session.dat',
        size: 2048,
        lastModified: 1726000000000,
        extension: '.dat',
      },
      {
        id: '5',
        name: '~$draft.docx',
        path: '~$draft.docx',
        size: 400,
        lastModified: 1726000000000,
        extension: '.docx',
      },
      {
        id: '6',
        name: '~lock.sheet.csv',
        path: '~lock.sheet.csv',
        size: 300,
        lastModified: 1726000000000,
        extension: '.csv',
      },
      {
        id: '7',
        name: 'download.part',
        path: 'download.part',
        size: 10000,
        lastModified: 1726000000000,
        extension: '.part',
      },
    ];

    const clusters = clusterFiles(files);
    const tempCluster = clusters.find((c) => c.key === 'pattern_temporary');
    expect(tempCluster).toBeDefined();

    // Verify template_contract and temperature_report are NOT in tempCluster
    const tempFileNames = tempCluster!.rawItems.map((f: any) => f.name);
    expect(tempFileNames).not.toContain('template_contract.pdf');
    expect(tempFileNames).not.toContain('temperature_report.pdf');

    // Verify tempCluster contains only valid temporary items
    expect(tempFileNames).toContain('temp_cache.bin');
    expect(tempFileNames).toContain('tmp_session.dat');
    expect(tempFileNames).toContain('~$draft.docx');
    expect(tempFileNames).toContain('~lock.sheet.csv');
    expect(tempFileNames).toContain('download.part');
  });

  it('matches backups strictly on .bak extension or backup_ prefix', () => {
    const files: FileItem[] = [
      {
        id: '1',
        name: 'database.bak',
        path: 'database.bak',
        size: 10000,
        lastModified: 1726000000000,
        extension: '.bak',
      },
      {
        id: '2',
        name: 'backup_2026.sql',
        path: 'backup_2026.sql',
        size: 20000,
        lastModified: 1726000000000,
        extension: '.sql',
      },
      {
        id: '3',
        name: 'weekly_backup_notes.txt',
        path: 'weekly_backup_notes.txt',
        size: 500,
        lastModified: 1726000000000,
        extension: '.txt',
      },
    ];

    const clusters = clusterFiles(files);
    const backupCluster = clusters.find((c) => c.key === 'pattern_backup');
    expect(backupCluster).toBeDefined();

    const backupNames = backupCluster!.rawItems.map((f: any) => f.name);
    expect(backupNames).toContain('database.bak');
    expect(backupNames).toContain('backup_2026.sql');
    expect(backupNames).not.toContain('weekly_backup_notes.txt');
  });

  it('clusters files by recognized patterns and extensions', () => {
    const files: FileItem[] = [
      {
        id: '1',
        name: 'Screenshot 2026-09-14.png',
        path: 'Screenshot 2026-09-14.png',
        size: 1000,
        lastModified: 1726323765000,
        extension: '.png',
      },
      {
        id: '2',
        name: 'Screenshot 2026-09-18.png',
        path: 'Screenshot 2026-09-18.png',
        size: 2000,
        lastModified: 1726683310000,
        extension: '.png',
      },
      {
        id: '3',
        name: 'backup_sqlite.bak',
        path: 'backup_sqlite.bak',
        size: 5000,
        lastModified: 1726500000000,
        extension: '.bak',
      },
      {
        id: '4',
        name: 'npm_debug.log',
        path: 'npm_debug.log',
        size: 800,
        lastModified: 1726150000000,
        extension: '.log',
      },
      {
        id: '5',
        name: 'docker-setup.dmg',
        path: 'docker-setup.dmg',
        size: 100000,
        lastModified: 1725510000000,
        extension: '.dmg',
      },
    ];

    const clusters = clusterFiles(files);
    expect(clusters.length).toBe(4);

    const screenshotCluster = clusters.find((c) => c.key === 'pattern_screenshot');
    expect(screenshotCluster).toBeDefined();
    expect(screenshotCluster?.count).toBe(2);
    expect(screenshotCluster?.totalMetric).toBe(3000);
    expect(screenshotCluster?.exampleItems.length).toBe(2);
  });

  it('clusters expenses by normalized merchant and groups credits/refunds into Income and refunds card', () => {
    const expenses: ExpenseItem[] = [
      {
        id: '1',
        date: '2026-07-02',
        description: 'NETFLIX.COM 866-579-7172 CA',
        normalizedMerchant: 'Netflix',
        amount: 19.99,
      },
      {
        id: '2',
        date: '2026-08-02',
        description: 'NETFLIX.COM 866-579-7172 CA',
        normalizedMerchant: 'Netflix',
        amount: 19.99,
      },
      {
        id: '3',
        date: '2026-07-08',
        description: 'UBER *TRIP 9812 SAN FRANCISCO CA',
        normalizedMerchant: 'Uber',
        amount: 24.5,
      },
      {
        id: '4',
        date: '2026-07-15',
        description: 'REFUND - STORE RETURN',
        normalizedMerchant: 'Store',
        amount: -45.10,
        isCreditOrRefund: true,
      },
    ];

    const clusters = clusterExpenses(expenses);
    expect(clusters.length).toBe(3);

    const netflix = clusters.find((c) => c.label === 'Netflix');
    expect(netflix).toBeDefined();
    expect(netflix?.count).toBe(2);
    expect(netflix?.totalMetric).toBeCloseTo(39.98, 2);

    const refundCluster = clusters.find((c) => c.isIncomeAndRefunds);
    expect(refundCluster).toBeDefined();
    expect(refundCluster?.label).toBe('Income and refunds');
    expect(refundCluster?.count).toBe(1);
    expect(refundCluster?.totalMetric).toBeCloseTo(45.10, 2);
  });

  it('matches local rules against clusters', () => {
    const rules: LocalRule[] = [
      {
        id: 'r1',
        packType: 'file',
        pattern: '*.tmp',
        matchType: 'extension',
        action: 'remove',
        createdAt: Date.now(),
      },
      {
        id: 'r2',
        packType: 'expense',
        pattern: 'Netflix',
        matchType: 'merchant_exact',
        action: 'sort',
        destination: 'Subscriptions',
        createdAt: Date.now(),
      },
    ];

    const fileCluster = {
      id: 'c1',
      packType: 'file' as const,
      key: 'pattern_temporary',
      label: 'Temporary Files',
      pattern: '*.tmp / temp*',
      count: 3,
      totalMetric: 100,
      exampleItems: ['cache.tmp'],
      rawItems: [],
    };

    const expenseCluster = {
      id: 'c2',
      packType: 'expense' as const,
      key: 'netflix',
      label: 'Netflix',
      pattern: 'Netflix',
      count: 4,
      totalMetric: 79.96,
      exampleItems: ['NETFLIX.COM'],
      rawItems: [],
    };

    expect(matchRule(fileCluster, rules)?.action).toBe('remove');
    expect(matchRule(expenseCluster, rules)?.destination).toBe('Subscriptions');
  });
});
