/**
 * Clean text and number formatters.
 * Note: Never use em dashes or en dashes anywhere.
 */

export type CurrencyCode = 'USD' | 'INR' | 'EUR' | 'GBP';
export type DateFormatOption = 'auto' | 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const safeIndex = Math.min(units.length - 1, Math.max(0, i));
  const val = bytes / Math.pow(1024, safeIndex);
  return `${val.toFixed(safeIndex === 0 ? 0 : 1)} ${units[safeIndex]}`;
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'USD'): string {
  const localeMap: Record<CurrencyCode, string> = {
    USD: 'en-US',
    INR: 'en-IN',
    EUR: 'de-DE',
    GBP: 'en-GB',
  };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseDateString(
  dateStr: string,
  preferredFormat: DateFormatOption = 'auto',
  forceDayFirst: boolean = false
): number | null {
  if (!dateStr) return null;
  const s = dateStr.trim();

  // Check ISO format YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const dt = new Date(Date.UTC(y, m, d));
    return isNaN(dt.getTime()) ? null : dt.getTime();
  }

  // Check 3-part date e.g. 24/09/2026 or 09/24/2026
  const partsMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (partsMatch) {
    const p1 = parseInt(partsMatch[1], 10);
    const p2 = parseInt(partsMatch[2], 10);
    let y = parseInt(partsMatch[3], 10);
    if (y < 100) y += 2000;

    let day = p1;
    let month = p2 - 1;

    if (preferredFormat === 'DD/MM/YYYY' || forceDayFirst || p1 > 12) {
      day = p1;
      month = p2 - 1;
    } else if (preferredFormat === 'MM/DD/YYYY') {
      month = p1 - 1;
      day = p2;
    } else {
      // Auto: if p1 > 12 day first, else default month first
      if (p1 > 12) {
        day = p1;
        month = p2 - 1;
      } else {
        month = p1 - 1;
        day = p2;
      }
    }

    const dt = new Date(Date.UTC(y, month, day));
    return isNaN(dt.getTime()) ? null : dt.getTime();
  }

  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt.getTime();
}

export function formatDateRange(
  firstDate?: number | string,
  lastDate?: number | string,
  preferredFormat: DateFormatOption = 'auto',
  forceDayFirst: boolean = false
): string {
  if (!firstDate && !lastDate) return 'No date recorded';

  const parse = (d: number | string): string => {
    try {
      const ts = typeof d === 'number' ? d : parseDateString(d, preferredFormat, forceDayFirst);
      if (!ts) return String(d);
      const date = new Date(ts);
      if (isNaN(date.getTime())) return String(d);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return String(d);
    }
  };

  const start = firstDate ? parse(firstDate) : '';
  const end = lastDate ? parse(lastDate) : '';

  if (start && end && start !== end) {
    return `${start} to ${end}`;
  }
  return start || end || 'Single date';
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
