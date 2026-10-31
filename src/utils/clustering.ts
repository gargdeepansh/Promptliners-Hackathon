import {
  FileItem,
  ExpenseItem,
  ItemCluster,
  RecurringCadence,
  LocalRule,
} from '../types';
import { formatCurrency, CurrencyCode, parseDateString } from './formatters';

/**
 * Strips currency symbols ($ € £ ₹), spaces and thousands separators,
 * and treats parentheses e.g. (45.10) or leading minus -45.10 as negative.
 */
export function parseAmount(raw: string | number | undefined): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;

  let s = String(raw).trim();
  if (!s) return 0;

  // Check for parentheses e.g. (45.10) or (1,234.56)
  const hasParentheses = /^\(.*\)$/.test(s);
  if (hasParentheses) {
    s = s.slice(1, -1).trim();
  }

  // Check for leading or trailing minus
  const hasMinus = s.startsWith('-') || s.endsWith('-');
  s = s.replace(/^[-\s]+|[-\s]+$/g, '');

  // Strip currency symbols ($ € £ ₹) and spaces
  s = s.replace(/[$€£₹\s]/g, '');

  // Strip thousands separators (commas)
  s = s.replace(/,/g, '');

  const val = parseFloat(s);
  if (isNaN(val)) return 0;

  const isNegative = hasParentheses || hasMinus;
  return isNegative ? -Math.abs(val) : val;
}

/**
 * Normalizes merchant description string from bank transaction statement.
 */
export function normalizeMerchant(rawDescription: string): string {
  if (!rawDescription) return 'Unknown Merchant';

  let desc = rawDescription.trim();

  // Check specific known brands on raw description first
  const rawUpper = rawDescription.toUpperCase();
  if (rawUpper.includes('UBER')) return 'Uber';
  if (rawUpper.includes('LYFT')) return 'Lyft';
  if (rawUpper.includes('NETFLIX')) return 'Netflix';
  if (rawUpper.includes('SPOTIFY')) return 'Spotify';
  if (rawUpper.includes('GITHUB')) return 'GitHub';
  if (rawUpper.includes('AMAZON') || rawUpper.includes('AMZN')) return 'Amazon';
  if (rawUpper.includes('APPLE.COM') || rawUpper.includes('APLPAY')) return 'Apple';
  if (rawUpper.includes('STARBUCKS')) return 'Starbucks';
  if (rawUpper.includes('WHOLEFDS') || rawUpper.includes('WHOLE FOODS')) return 'Whole Foods';
  if (rawUpper.includes('CHIPOTLE')) return 'Chipotle';
  if (rawUpper.includes('SWEETGREEN')) return 'Sweetgreen';
  if (rawUpper.includes('TRADER JOE')) return "Trader Joe's";
  if (rawUpper.includes('TARGET')) return 'Target';
  if (rawUpper.includes('DOORDASH')) return 'DoorDash';
  if (rawUpper.includes('INSTACART')) return 'Instacart';
  if (rawUpper.includes('PG&E') || rawUpper.includes('PACIFIC GAS')) return 'PG&E';
  if (rawUpper.includes('CON EDISON')) return 'Con Edison';
  if (rawUpper.includes('COMCAST') || rawUpper.includes('XFINITY')) return 'Comcast';
  if (rawUpper.includes('NYTIMES')) return 'NYTimes';
  if (
    rawUpper.includes('GOOGLE *CLOUD') ||
    rawUpper.includes('GOOGLE *STORAGE') ||
    rawUpper.includes('GOOGLE *WORKSPACE')
  ) {
    return 'Google Services';
  }

  // Common payment processor prefix cleanups for other merchants
  desc = desc.replace(/^(SQ\s*\*|PAYPAL\s*\*|TST\s*\*)/i, '');

  // Strip trailing phone numbers, store numbers, cities, and noise
  desc = desc.replace(/#\d+/g, '');
  desc = desc.replace(/\*\w+/g, '');
  desc = desc.replace(/\b\d{3,}\b/g, '');
  desc = desc.replace(/\b(CA|NY|WA|TX|IL|FL|CO|MA|US|USA)\b/g, '');
  desc = desc.replace(/[\*\#\-\_\:\/]/g, ' ');
  desc = desc.replace(/\s+/g, ' ').trim();

  if (!desc) {
    return rawDescription.trim().slice(0, 24);
  }

  // Title case the merchant name
  return desc
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Detects recurring charge cadence based on transaction dates and amounts.
 * Requires:
 * 1. Interval standard deviation of at most 25 percent of the average.
 * 2. Every amount within 10 percent of the median amount.
 */
export function detectRecurringCadence(items: ExpenseItem[]): RecurringCadence {
  if (items.length < 2) {
    return { isRecurring: false, count: items.length, averageIntervalDays: 0 };
  }

  // Parse dates and sort chronologically
  const dates = items
    .map((item) => {
      const ts = parseDateString(item.date);
      return ts || new Date(item.date).getTime();
    })
    .filter((ts) => !isNaN(ts))
    .sort((a, b) => a - b);

  if (dates.length < 2) {
    return { isRecurring: false, count: items.length, averageIntervalDays: 0 };
  }

  const intervalsInDays: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const diffDays = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      intervalsInDays.push(diffDays);
    }
  }

  if (intervalsInDays.length === 0) {
    return { isRecurring: false, count: items.length, averageIntervalDays: 0 };
  }

  const sumDays = intervalsInDays.reduce((acc, d) => acc + d, 0);
  const avgDays = Math.round(sumDays / intervalsInDays.length);

  // Check variance and standard deviation of intervals
  const variance =
    intervalsInDays.reduce((acc, d) => acc + Math.pow(d - avgDays, 2), 0) / intervalsInDays.length;
  const stdDev = Math.sqrt(variance);

  // Requirement 1: interval standard deviation at most 25% of average
  const isIntervalConsistent = stdDev <= avgDays * 0.25;

  // Requirement 2: every amount within 10% of median amount
  const amounts = items.map((i) => Math.abs(i.amount)).sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const medianAmount = amounts.length % 2 === 0 ? (amounts[mid - 1] + amounts[mid]) / 2 : amounts[mid];

  const amountsConsistent = amounts.every((amt) => {
    if (medianAmount === 0) return amt === 0;
    return Math.abs(amt - medianAmount) <= medianAmount * 0.10;
  });

  // Detect cadence targets:
  // Weekly: ~7 days (5 to 9)
  // Bi-weekly: ~14 days (12 to 16)
  // Monthly: ~30 days (26 to 34)
  // Quarterly: ~90 days (80 to 100)
  // Yearly: ~365 days (350 to 380)
  const isCadenceTarget =
    (avgDays >= 5 && avgDays <= 9) ||
    (avgDays >= 12 && avgDays <= 16) ||
    (avgDays >= 26 && avgDays <= 34) ||
    (avgDays >= 80 && avgDays <= 100) ||
    (avgDays >= 350 && avgDays <= 380);

  const isRecurring = isCadenceTarget && isIntervalConsistent && amountsConsistent;

  return {
    isRecurring,
    count: items.length,
    averageIntervalDays: avgDays,
  };
}

/**
 * Clusters an array of FileItems into cards.
 * Temporary group matches ONLY:
 * - extensions .tmp, .temp, .swp, .part, .crdownload
 * - names starting with ~$ or ~lock.
 * - exact prefixes temp_ and tmp_
 * Backup group matches ONLY:
 * - .bak extension or prefix backup_
 */
export function clusterFiles(files: FileItem[]): ItemCluster[] {
  const groups: Map<string, { label: string; pattern: string; items: FileItem[] }> = new Map();

  for (const file of files) {
    const name = file.name.toLowerCase();
    const ext = (file.extension || '').toLowerCase();

    let key = '';
    let label = '';
    let pattern = '';

    // Check temporary group first: strictly .tmp, .temp, .swp, .part, .crdownload,
    // names starting with ~$ or ~lock., and exact prefixes temp_ or tmp_
    const isTempExt = ['.tmp', '.temp', '.swp', '.part', '.crdownload'].includes(ext);
    const isTempPrefix = name.startsWith('temp_') || name.startsWith('tmp_');
    const isTempLock = name.startsWith('~$') || name.startsWith('~lock.');

    if (isTempExt || isTempPrefix || isTempLock) {
      key = 'pattern_temporary';
      label = 'Temporary & Lock Files';
      pattern = '*.tmp, temp_*, ~lock.*';
    } else if (ext === '.bak' || name.startsWith('backup_')) {
      // Backup group matches ONLY .bak extension or backup_ prefix
      key = 'pattern_backup';
      label = 'Backup Files';
      pattern = '*.bak / backup_*';
    } else if (file.isDuplicate) {
      key = 'pattern_duplicates';
      label = 'Duplicate Candidates';
      pattern = 'Identical Size & Extension';
    } else if (name.startsWith('screenshot') || name.startsWith('screen shot')) {
      key = 'pattern_screenshot';
      label = 'Screenshots';
      pattern = 'Screenshot*';
    } else if (ext === '.log' || name.endsWith('_trace.log') || name.endsWith('_error.log')) {
      key = 'pattern_logs';
      label = 'Log Files';
      pattern = '*.log';
    } else if (['.dmg', '.exe', '.pkg', '.msi', '.deb'].includes(ext)) {
      key = 'pattern_installers';
      label = 'Application Installers';
      pattern = '*.dmg / *.exe / *.pkg';
    } else if (name.startsWith('img_') || name.startsWith('dsc_') || name.startsWith('dji_')) {
      key = 'pattern_camera_photos';
      label = 'Camera & Drone Imports';
      pattern = 'IMG_* / DSC_*';
    } else if (name.startsWith('invoice') || name.startsWith('receipt')) {
      key = 'pattern_invoices';
      label = 'Invoices & Receipts';
      pattern = 'Invoice* / Receipt*';
    } else if (['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z'].includes(ext)) {
      key = 'ext_archives';
      label = 'Compressed Archives';
      pattern = '*.zip / *.tar.gz';
    } else if (['.pdf'].includes(ext)) {
      key = 'ext_pdf';
      label = 'PDF Documents';
      pattern = '*.pdf';
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) {
      key = `ext_images_${ext.replace('.', '')}`;
      label = `${ext.replace('.', '').toUpperCase()} Images`;
      pattern = `*${ext}`;
    } else if (['.mp4', '.mov', '.mkv', '.webm'].includes(ext)) {
      key = 'ext_video';
      label = 'Video Files';
      pattern = '*.mp4 / *.mov';
    } else if (['.mp3', '.wav', '.m4a', '.flac'].includes(ext)) {
      key = 'ext_audio';
      label = 'Audio Files';
      pattern = '*.mp3 / *.wav';
    } else if (['.json', '.csv', '.tsv', '.xml'].includes(ext)) {
      key = `ext_data_${ext.replace('.', '')}`;
      label = `${ext.replace('.', '').toUpperCase()} Data Files`;
      pattern = `*${ext}`;
    } else if (ext) {
      key = `ext_${ext.replace('.', '')}`;
      label = `${ext.toUpperCase()} Files`;
      pattern = `*${ext}`;
    } else {
      key = 'other_no_ext';
      label = 'Uncategorized Files';
      pattern = 'No extension';
    }

    if (!groups.has(key)) {
      groups.set(key, { label, pattern, items: [] });
    }
    groups.get(key)!.items.push(file);
  }

  // Convert to ItemCluster array
  const clusters: ItemCluster[] = [];
  for (const [key, group] of groups.entries()) {
    const totalBytes = group.items.reduce((sum, item) => sum + item.size, 0);
    const timestamps = group.items.map((i) => i.lastModified).filter((t) => t > 0);
    const firstDate = timestamps.length ? Math.min(...timestamps) : undefined;
    const lastDate = timestamps.length ? Math.max(...timestamps) : undefined;
    const exampleItems = group.items.slice(0, 3).map((i) => i.name);

    clusters.push({
      id: `cluster_file_${key}`,
      packType: 'file',
      key,
      label: group.label,
      pattern: group.pattern,
      count: group.items.length,
      totalMetric: totalBytes,
      firstDate,
      lastDate,
      exampleItems,
      rawItems: group.items,
      isDuplicateCluster: key === 'pattern_duplicates',
    });
  }

  // Sort clusters descending by item count
  return clusters.sort((a, b) => b.count - a.count);
}

/**
 * Clusters an array of ExpenseItems into cards by normalized merchant.
 * Credits and refunds are grouped into an "Income and refunds" card.
 */
export function clusterExpenses(
  expenses: ExpenseItem[],
  currency: CurrencyCode = 'USD'
): ItemCluster[] {
  const groups: Map<string, { merchant: string; items: ExpenseItem[]; isIncome: boolean }> =
    new Map();

  for (const item of expenses) {
    if (item.isCreditOrRefund) {
      const key = '__income_and_refunds__';
      if (!groups.has(key)) {
        groups.set(key, { merchant: 'Income and refunds', items: [], isIncome: true });
      }
      groups.get(key)!.items.push(item);
    } else {
      const merchant = item.normalizedMerchant || 'Unknown Merchant';
      const key = merchant.toLowerCase().trim();

      if (!groups.has(key)) {
        groups.set(key, { merchant, items: [], isIncome: false });
      }
      groups.get(key)!.items.push(item);
    }
  }

  const clusters: ItemCluster[] = [];
  for (const [key, group] of groups.entries()) {
    const totalAmount = group.items.reduce((sum, item) => sum + Math.abs(item.amount), 0);

    // Dates
    const dates = group.items
      .map((i) => parseDateString(i.date) || new Date(i.date).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);

    const firstDate = dates.length ? dates[0] : undefined;
    const lastDate = dates.length ? dates[dates.length - 1] : undefined;
    const recurringInfo = group.isIncome ? undefined : detectRecurringCadence(group.items);

    const exampleItems = group.items.slice(0, 3).map((i) => {
      const formattedAmount = formatCurrency(Math.abs(i.amount), currency);
      return `${i.description} (${formattedAmount})`;
    });

    clusters.push({
      id: `cluster_expense_${key.replace(/[^a-z0-9_]/g, '_')}`,
      packType: 'expense',
      key,
      label: group.merchant,
      pattern: group.isIncome ? 'Income / Refunds / Credits' : group.merchant,
      count: group.items.length,
      totalMetric: totalAmount,
      firstDate,
      lastDate,
      exampleItems,
      rawItems: group.items,
      recurringInfo,
      isIncomeAndRefunds: group.isIncome,
    });
  }

  // Sort clusters: regular expenses descending by count/total, income/refunds at the end
  return clusters.sort((a, b) => {
    if (a.isIncomeAndRefunds) return 1;
    if (b.isIncomeAndRefunds) return -1;
    return b.count - a.count || b.totalMetric - a.totalMetric;
  });
}

/**
 * Evaluates whether an item cluster matches an active local rule.
 */
export function matchRule(cluster: ItemCluster, rules: LocalRule[]): LocalRule | undefined {
  return rules.find((rule) => {
    if (rule.packType !== cluster.packType) return false;

    const pattern = rule.pattern.toLowerCase();
    const clusterLabel = cluster.label.toLowerCase();
    const clusterKey = cluster.key.toLowerCase();
    const clusterPattern = cluster.pattern.toLowerCase();

    switch (rule.matchType) {
      case 'merchant_exact':
        return clusterLabel === pattern || clusterKey === pattern;
      case 'merchant_contains':
        return clusterLabel.includes(pattern) || clusterKey.includes(pattern);
      case 'extension':
        return clusterPattern.includes(pattern) || clusterKey.includes(pattern);
      case 'name_prefix':
        return clusterLabel.startsWith(pattern) || clusterPattern.startsWith(pattern);
      default:
        return clusterPattern === pattern || clusterLabel === pattern;
    }
  });
}
