import { ExpenseItem } from '../types';
import { normalizeMerchant, parseAmount } from '../utils/clustering';
import { DateFormatOption, parseDateString } from '../utils/formatters';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: '1', key: 'Food', label: 'Food & Dining', numKey: '1' },
  { id: '2', key: 'Transport', label: 'Transport & Rides', numKey: '2' },
  { id: '3', key: 'Bills', label: 'Utilities & Bills', numKey: '3' },
  { id: '4', key: 'Subscriptions', label: 'Subscriptions', numKey: '4' },
  { id: '5', key: 'Shopping', label: 'Shopping', numKey: '5' },
  { id: '6', key: 'Other', label: 'Other Chores', numKey: '6' },
];

export const DEFAULT_FILE_DESTINATIONS = [
  { id: '1', key: 'Documents', label: 'Documents', numKey: '1' },
  { id: '2', key: 'Images', label: 'Images', numKey: '2' },
  { id: '3', key: 'Archives', label: 'Archives', numKey: '3' },
  { id: '4', key: 'Installers', label: 'Installers', numKey: '4' },
  { id: '5', key: 'Media', label: 'Media', numKey: '5' },
  { id: '6', key: 'Code', label: 'Code & Logs', numKey: '6' },
  { id: '7', key: 'Financial', label: 'Financial', numKey: '7' },
  { id: '8', key: 'Work', label: 'Work', numKey: '8' },
  { id: '9', key: 'Personal', label: 'Personal', numKey: '9' },
];

export const SAMPLE_EXPENSES_RAW_CSV = `Date,Description,Amount
2026-07-02,NETFLIX.COM 866-579-7172 CA,19.99
2026-07-05,WHOLEFDS SFO 10293 SAN FRANCISCO CA,68.40
2026-07-08,UBER *TRIP 9812 SAN FRANCISCO CA,24.50
2026-07-10,STARBUCKS STORE #10492 SAN FRANCISCO CA,6.25
2026-07-12,SPOTIFY USA 877-778-1161 NY,11.99
2026-07-15,PG&E ELECTRIC ONLINE PMT,118.45
2026-07-18,AMZN MKTP US*1J209A SEATTLE WA,34.20
2026-07-22,CHIPOTLE 2914 SAN FRANCISCO CA,16.80
2026-07-25,GITHUB INC SAN FRANCISCO CA,10.00
2026-07-28,TRADER JOE #0192 SAN FRANCISCO CA,54.10
2026-08-02,NETFLIX.COM 866-579-7172 CA,19.99
2026-08-04,SWEETGREEN MISSION ST SFO,17.45
2026-08-07,UBER *TRIP 1102 SAN FRANCISCO CA,31.20
2026-08-11,STARBUCKS STORE #10492 SAN FRANCISCO CA,5.85
2026-08-12,SPOTIFY USA 877-778-1161 NY,11.99
2026-08-14,COMCAST XFINITY CABLE CABLE PMT,85.00
2026-08-16,WHOLEFDS SFO 10293 SAN FRANCISCO CA,82.15
2026-08-18,AMAZON RETURN REFUND SEATTLE WA,(34.20)
2026-08-20,AMZN MKTP US*99482B SEATTLE WA,89.50
2026-08-25,GITHUB INC SAN FRANCISCO CA,10.00
2026-08-29,LYFT *RIDE MON 4PM SAN FRANCISCO,18.75
2026-09-02,NETFLIX.COM 866-579-7172 CA,19.99
2026-09-04,TRADER JOE #0192 SAN FRANCISCO CA,61.90
2026-09-07,UBER *TRIP 4492 SAN FRANCISCO CA,19.80
2026-09-10,STARBUCKS STORE #10492 SAN FRANCISCO CA,6.45
2026-09-12,SPOTIFY USA 877-778-1161 NY,11.99
2026-09-15,PG&E ELECTRIC ONLINE PMT,132.80
2026-09-19,APPLE.COM/BILL 866-712-7753 CA,9.99
2026-09-22,CHIPOTLE 2914 SAN FRANCISCO CA,15.40
2026-09-25,GITHUB INC SAN FRANCISCO CA,10.00
2026-09-27,AMZN MKTP US*7A881C SEATTLE WA,42.00
2026-10-02,NETFLIX.COM 866-579-7172 CA,19.99
2026-10-06,WHOLEFDS SFO 10293 SAN FRANCISCO CA,74.30
2026-10-09,UBER *TRIP 5582 SAN FRANCISCO CA,28.40
2026-10-12,SPOTIFY USA 877-778-1161 NY,11.99
2026-10-14,COMCAST XFINITY CABLE CABLE PMT,85.00
2026-10-16,SWEETGREEN MISSION ST SFO,18.20
2026-10-20,TARGET ST 1402 SAN FRANCISCO CA,48.60
2026-10-22,MERCHANT CASHBACK REWARD DEPOSIT,-25.00
2026-10-25,GITHUB INC SAN FRANCISCO CA,10.00
2026-10-27,STARBUCKS STORE #10492 SAN FRANCISCO CA,6.25
2026-10-28,LYFT *RIDE THU 7PM SAN FRANCISCO,22.10
2026-10-29,AMZN MKTP US*33190D SEATTLE WA,64.20
2026-10-30,NYTIMES DIGITAL SUBSCRIPTION NY,4.00
`;

/**
 * Splits a CSV row respecting double quotes and escaped quotes.
 */
export function splitCSVRow(line: string): string[] {
  const row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current.trim().replace(/^"|"$/g, ''));
  return row;
}

/**
 * Extracts header names from raw CSV text.
 */
export function extractCSVHeaders(csvText: string): string[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  return splitCSVRow(lines[0]);
}

export interface CSVParserMapping {
  dateCol?: string;
  descCol?: string;
  amountCol?: string;
  debitCol?: string;
  creditCol?: string;
  dateFormat?: DateFormatOption;
}

export function parseCSVString(csvText: string, mapping?: CSVParserMapping): ExpenseItem[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = splitCSVRow(lines[0]);

  // Determine column indexes
  let dateIdx = -1;
  let descIdx = -1;
  let amountIdx = -1;
  let debitIdx = -1;
  let creditIdx = -1;

  if (mapping) {
    if (mapping.dateCol) dateIdx = headers.indexOf(mapping.dateCol);
    if (mapping.descCol) descIdx = headers.indexOf(mapping.descCol);
    if (mapping.amountCol) amountIdx = headers.indexOf(mapping.amountCol);
    if (mapping.debitCol) debitIdx = headers.indexOf(mapping.debitCol);
    if (mapping.creditCol) creditIdx = headers.indexOf(mapping.creditCol);
  }

  // Fallbacks if unmapped
  if (dateIdx === -1) {
    dateIdx = headers.findIndex((h) => /date|time/i.test(h));
    if (dateIdx === -1) dateIdx = 0;
  }
  if (descIdx === -1) {
    descIdx = headers.findIndex((h) => /desc|merchant|payee|name|memo/i.test(h));
    if (descIdx === -1) descIdx = Math.min(1, headers.length - 1);
  }
  if (amountIdx === -1 && debitIdx === -1) {
    debitIdx = headers.findIndex((h) => /^debit$/i.test(h));
    creditIdx = headers.findIndex((h) => /^credit$/i.test(h));
    if (debitIdx === -1) {
      amountIdx = headers.findIndex((h) => /amount|total|charge/i.test(h));
      if (amountIdx === -1) amountIdx = Math.min(2, headers.length - 1);
    }
  }

  // Detect whether any row has first number above 12 to assume day-first
  let hasDayAbove12 = false;
  for (let i = 1; i < Math.min(lines.length, 50); i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const row = splitCSVRow(rawLine);
    const dateVal = row[dateIdx] || '';
    const m = dateVal.match(/^(\d{1,2})[-/.]/);
    if (m && parseInt(m[1], 10) > 12) {
      hasDayAbove12 = true;
      break;
    }
  }

  const items: ExpenseItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const row = splitCSVRow(rawLine);
    const rawDate = row[dateIdx] || '';
    const rawDesc = row[descIdx] || 'Unknown Charge';

    let finalAmount = 0;
    let isIncomeOrRefund = false;

    // Separate debit and credit columns
    if (debitIdx !== -1 || creditIdx !== -1) {
      const debitVal = debitIdx !== -1 ? parseAmount(row[debitIdx]) : 0;
      const creditVal = creditIdx !== -1 ? parseAmount(row[creditIdx]) : 0;

      if (creditVal > 0 && debitVal === 0) {
        finalAmount = creditVal;
        isIncomeOrRefund = true;
      } else if (debitVal !== 0) {
        finalAmount = Math.abs(debitVal);
        if (debitVal < 0) {
          isIncomeOrRefund = true;
        }
      } else if (creditVal !== 0) {
        finalAmount = Math.abs(creditVal);
        isIncomeOrRefund = true;
      }
    } else if (amountIdx !== -1) {
      const rawAmt = row[amountIdx];
      const parsed = parseAmount(rawAmt);

      if (parsed < 0) {
        // Negative amount indicates refund/credit
        finalAmount = Math.abs(parsed);
        isIncomeOrRefund = true;
      } else {
        finalAmount = parsed;
        const upperDesc = rawDesc.toUpperCase();
        if (
          upperDesc.includes('REFUND') ||
          upperDesc.includes('RETURN') ||
          upperDesc.includes('CASHBACK') ||
          upperDesc.includes('PAYROLL') ||
          upperDesc.includes('CREDIT')
        ) {
          isIncomeOrRefund = true;
        }
      }
    }

    if (rawDesc && rawDesc !== 'Unknown Charge') {
      items.push({
        id: `exp_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: rawDate,
        description: rawDesc,
        normalizedMerchant: normalizeMerchant(rawDesc),
        amount: finalAmount,
        isCreditOrRefund: isIncomeOrRefund,
      });
    }
  }

  return items;
}

export const SAMPLE_EXPENSES: ExpenseItem[] = parseCSVString(SAMPLE_EXPENSES_RAW_CSV);
