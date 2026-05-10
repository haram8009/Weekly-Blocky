import type { DateString, TimeEntrySource, TimeString, TimestampString } from './index';
import { validateTimeRange } from './time';

export const UTF8_BOM = '\uFEFF';

export const TIME_ENTRY_CSV_HEADERS = [
  'date',
  'startTime',
  'endTime',
  'durationMinutes',
  'categoryName',
  'categoryColor',
  'categoryEmoji',
  'note',
  'source',
  'photoCount',
  'createdAt',
  'updatedAt',
] as const;

export type TimeEntryCsvHeader = (typeof TIME_ENTRY_CSV_HEADERS)[number];

export type TimeEntryCsvInput = {
  date: DateString;
  startTime: TimeString;
  endTime: TimeString;
  categoryName: string;
  categoryColor: string;
  categoryEmoji: string;
  note: string;
  source: TimeEntrySource;
  photoCount: number;
  createdAt: TimestampString;
  updatedAt: TimestampString;
};

export function createTimeEntriesCsv(entries: readonly TimeEntryCsvInput[]): string {
  const rows = [...entries]
    .sort(compareTimeEntryCsvInput)
    .map((entry) => TIME_ENTRY_CSV_HEADERS.map((header) => getTimeEntryCsvValue(entry, header)));

  return `${UTF8_BOM}${serializeCsvRows([TIME_ENTRY_CSV_HEADERS, ...rows])}`;
}

function compareTimeEntryCsvInput(a: TimeEntryCsvInput, b: TimeEntryCsvInput): number {
  const dateComparison = a.date.localeCompare(b.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return a.startTime.localeCompare(b.startTime);
}

function getTimeEntryCsvValue(entry: TimeEntryCsvInput, header: TimeEntryCsvHeader): string | number {
  if (header === 'durationMinutes') {
    return calculateDurationMinutes(entry);
  }

  return entry[header];
}

function calculateDurationMinutes(entry: TimeEntryCsvInput): number {
  const validation = validateTimeRange(entry.startTime, entry.endTime);

  if (!validation.isValid) {
    throw new Error(
      `CSV 내보내기 기록 시간 범위가 올바르지 않습니다: ${entry.date} ${entry.startTime}-${entry.endTime}`,
    );
  }

  return validation.endMinutes - validation.startMinutes;
}

function serializeCsvRows(rows: readonly (readonly (string | number)[])[]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
}

function escapeCsvField(value: string | number): string {
  const text = String(value);

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}
