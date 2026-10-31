import { describe, it, expect } from 'vitest';
import { detectRecurringCadence, clusterExpenses } from '../utils/clustering';
import { ExpenseItem } from '../types';
import { SAMPLE_EXPENSES } from '../data/sampleExpenses';

describe('Recurring Cadence Detection', () => {
  it('detects monthly recurring subscriptions spaced around 30 days apart', () => {
    const netflixItems: ExpenseItem[] = [
      {
        id: '1',
        date: '2026-06-02',
        description: 'NETFLIX.COM',
        normalizedMerchant: 'Netflix',
        amount: 19.99,
      },
      {
        id: '2',
        date: '2026-07-02',
        description: 'NETFLIX.COM',
        normalizedMerchant: 'Netflix',
        amount: 19.99,
      },
      {
        id: '3',
        date: '2026-08-02',
        description: 'NETFLIX.COM',
        normalizedMerchant: 'Netflix',
        amount: 19.99,
      },
      {
        id: '4',
        date: '2026-09-02',
        description: 'NETFLIX.COM',
        normalizedMerchant: 'Netflix',
        amount: 19.99,
      },
    ];

    const cadence = detectRecurringCadence(netflixItems);
    expect(cadence.isRecurring).toBe(true);
    expect(cadence.count).toBe(4);
    expect(cadence.averageIntervalDays).toBeGreaterThanOrEqual(28);
    expect(cadence.averageIntervalDays).toBeLessThanOrEqual(32);
  });

  it('detects weekly cadence spaced ~7 days apart with equal amounts', () => {
    const weeklyGroceries: ExpenseItem[] = [
      {
        id: '1',
        date: '2026-09-01',
        description: 'FARMERS MKT',
        normalizedMerchant: 'Farmers Mkt',
        amount: 40.0,
      },
      {
        id: '2',
        date: '2026-09-08',
        description: 'FARMERS MKT',
        normalizedMerchant: 'Farmers Mkt',
        amount: 40.0,
      },
      {
        id: '3',
        date: '2026-09-15',
        description: 'FARMERS MKT',
        normalizedMerchant: 'Farmers Mkt',
        amount: 40.0,
      },
      {
        id: '4',
        date: '2026-09-22',
        description: 'FARMERS MKT',
        normalizedMerchant: 'Farmers Mkt',
        amount: 40.0,
      },
    ];

    const cadence = detectRecurringCadence(weeklyGroceries);
    expect(cadence.isRecurring).toBe(true);
    expect(cadence.count).toBe(4);
    expect(cadence.averageIntervalDays).toBe(7);
  });

  it('verifies that varied ride-share charges are NOT recurring', () => {
    const uberRides: ExpenseItem[] = [
      {
        id: '1',
        date: '2026-09-01',
        description: 'UBER *TRIP 1',
        normalizedMerchant: 'Uber',
        amount: 18.5,
      },
      {
        id: '2',
        date: '2026-09-08',
        description: 'UBER *TRIP 2',
        normalizedMerchant: 'Uber',
        amount: 32.4,
      },
      {
        id: '3',
        date: '2026-09-15',
        description: 'UBER *TRIP 3',
        normalizedMerchant: 'Uber',
        amount: 14.2,
      },
      {
        id: '4',
        date: '2026-09-22',
        description: 'UBER *TRIP 4',
        normalizedMerchant: 'Uber',
        amount: 45.1,
      },
    ];

    const cadence = detectRecurringCadence(uberRides);
    expect(cadence.isRecurring).toBe(false);
  });

  it('verifies that varied shopping charges are NOT recurring', () => {
    const amazonPurchases: ExpenseItem[] = [
      {
        id: '1',
        date: '2026-08-01',
        description: 'AMAZON.COM ORDER 1',
        normalizedMerchant: 'Amazon',
        amount: 15.99,
      },
      {
        id: '2',
        date: '2026-08-15',
        description: 'AMAZON.COM ORDER 2',
        normalizedMerchant: 'Amazon',
        amount: 112.5,
      },
      {
        id: '3',
        date: '2026-09-01',
        description: 'AMAZON.COM ORDER 3',
        normalizedMerchant: 'Amazon',
        amount: 45.0,
      },
      {
        id: '4',
        date: '2026-09-15',
        description: 'AMAZON.COM ORDER 4',
        normalizedMerchant: 'Amazon',
        amount: 8.99,
      },
    ];

    const cadence = detectRecurringCadence(amazonPurchases);
    expect(cadence.isRecurring).toBe(false);
  });

  it('returns false for single transactions or irregular intervals', () => {
    const singleCharge: ExpenseItem[] = [
      {
        id: '1',
        date: '2026-09-01',
        description: 'ONE TIME PURCHASE',
        normalizedMerchant: 'Store',
        amount: 120.0,
      },
    ];

    expect(detectRecurringCadence(singleCharge).isRecurring).toBe(false);

    const irregularCharges: ExpenseItem[] = [
      {
        id: '1',
        date: '2026-01-01',
        description: 'REPAIR SHOP',
        normalizedMerchant: 'Repair Shop',
        amount: 50.0,
      },
      {
        id: '2',
        date: '2026-01-03',
        description: 'REPAIR SHOP',
        normalizedMerchant: 'Repair Shop',
        amount: 50.0,
      },
      {
        id: '3',
        date: '2026-08-20',
        description: 'REPAIR SHOP',
        normalizedMerchant: 'Repair Shop',
        amount: 50.0,
      },
    ];

    expect(detectRecurringCadence(irregularCharges).isRecurring).toBe(false);
  });

  it('verifies in sample data that Netflix, Spotify and GitHub are recurring while Uber and Amazon are not', () => {
    const clusters = clusterExpenses(SAMPLE_EXPENSES);

    const netflix = clusters.find((c) => c.label === 'Netflix');
    expect(netflix).toBeDefined();
    expect(netflix?.recurringInfo?.isRecurring).toBe(true);

    const spotify = clusters.find((c) => c.label === 'Spotify');
    expect(spotify).toBeDefined();
    expect(spotify?.recurringInfo?.isRecurring).toBe(true);

    const github = clusters.find((c) => c.label === 'GitHub');
    expect(github).toBeDefined();
    expect(github?.recurringInfo?.isRecurring).toBe(true);

    const uber = clusters.find((c) => c.label === 'Uber');
    expect(uber).toBeDefined();
    expect(uber?.recurringInfo?.isRecurring).toBe(false);

    const amazon = clusters.find((c) => c.label === 'Amazon');
    expect(amazon).toBeDefined();
    expect(amazon?.recurringInfo?.isRecurring).toBe(false);
  });
});
