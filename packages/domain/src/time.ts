const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const CAPTURED_AT_PATTERN = /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})/;
const MINUTES_PER_DAY = 24 * 60;
const MAX_DIARY_MINUTES = 29 * 60;
const DAYS_PER_WEEK = 7;

export type TimeRangeValidationError =
  | 'INVALID_START_TIME'
  | 'INVALID_END_TIME'
  | 'START_NOT_ALIGNED'
  | 'END_NOT_ALIGNED'
  | 'START_MUST_BE_BEFORE_END'
  | 'START_CANNOT_BE_24_00';

export type TimeRangeValidationResult =
  | {
      isValid: true;
      startMinutes: number;
      endMinutes: number;
    }
  | {
      isValid: false;
      errors: TimeRangeValidationError[];
    };

export type TimeRangeEntryLike = {
  date: string;
  startTime: string;
  endTime: string;
};

export function parseTimeToMinutes(time: string): number {
  const match = TIME_PATTERN.exec(time);

  if (!match) {
    throw new Error(`잘못된 시간 형식입니다: ${time}`);
  }

  const [, hourText, minuteText] = match;
  const hours = Number(hourText);
  const minutes = Number(minuteText);

  if (hours === 24 && minutes === 0) {
    return MINUTES_PER_DAY;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`잘못된 시간 값입니다: ${time}`);
  }

  return hours * 60 + minutes;
}

export function parseDiaryTimeToMinutes(time: string): number {
  const match = TIME_PATTERN.exec(time);

  if (!match) {
    throw new Error(`잘못된 일지 시간 형식입니다: ${time}`);
  }

  const [, hourText, minuteText] = match;
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  const totalMinutes = hours * 60 + minutes;

  if (hours < 0 || minutes < 0 || minutes > 59 || totalMinutes > MAX_DIARY_MINUTES) {
    throw new Error(`잘못된 일지 시간 값입니다: ${time}`);
  }

  return totalMinutes;
}

export function formatMinutesToTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MINUTES_PER_DAY) {
    throw new Error(`분 값은 0 이상 1440 이하의 정수여야 합니다: ${minutes}`);
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
}

export function formatDiaryMinutesToTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_DIARY_MINUTES) {
    throw new Error(`일지 분 값은 0 이상 ${MAX_DIARY_MINUTES} 이하의 정수여야 합니다: ${minutes}`);
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
}

export function formatDiaryTimeLabel(time: string): string {
  const minutes = parseDiaryTimeToMinutes(time);

  if (minutes < MINUTES_PER_DAY) {
    return time;
  }

  return `다음날 ${formatMinutesToTime(minutes - MINUTES_PER_DAY)}`;
}

export function isTenMinuteAligned(time: string): boolean {
  try {
    return parseTimeToMinutes(time) % 10 === 0;
  } catch {
    return false;
  }
}

export function validateDiaryTimeRange(
  startTime: string,
  endTime: string,
): TimeRangeValidationResult {
  const errors: TimeRangeValidationError[] = [];
  const startMinutes = tryParseDiaryTime(startTime);
  const endMinutes = tryParseDiaryTime(endTime);

  if (startMinutes === null) {
    errors.push('INVALID_START_TIME');
  }

  if (endMinutes === null) {
    errors.push('INVALID_END_TIME');
  }

  if (startMinutes !== null && startMinutes % 10 !== 0) {
    errors.push('START_NOT_ALIGNED');
  }

  if (endMinutes !== null && endMinutes % 10 !== 0) {
    errors.push('END_NOT_ALIGNED');
  }

  if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
    errors.push('START_MUST_BE_BEFORE_END');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    startMinutes: startMinutes!,
    endMinutes: endMinutes!,
  };
}

export function validateTimeRange(startTime: string, endTime: string): TimeRangeValidationResult {
  const errors: TimeRangeValidationError[] = [];
  const startMinutes = tryParseTime(startTime);
  const endMinutes = tryParseTime(endTime);

  if (startMinutes === null) {
    errors.push('INVALID_START_TIME');
  }

  if (endMinutes === null) {
    errors.push('INVALID_END_TIME');
  }

  if (startMinutes !== null && startMinutes === MINUTES_PER_DAY) {
    errors.push('START_CANNOT_BE_24_00');
  }

  if (startMinutes !== null && startMinutes % 10 !== 0) {
    errors.push('START_NOT_ALIGNED');
  }

  if (endMinutes !== null && endMinutes % 10 !== 0) {
    errors.push('END_NOT_ALIGNED');
  }

  if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
    errors.push('START_MUST_BE_BEFORE_END');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    startMinutes: startMinutes!,
    endMinutes: endMinutes!,
  };
}

export function getWeekStartDate(date: string, weekStartsOn: 'monday' | 'sunday'): string {
  const parsedDate = parseDateString(date);
  const day = parsedDate.getUTCDay();
  const offset = weekStartsOn === 'monday' ? (day === 0 ? 6 : day - 1) : day;

  parsedDate.setUTCDate(parsedDate.getUTCDate() - offset);

  return formatDateString(parsedDate);
}

export function getDatesOfWeek(weekStartDate: string): string[] {
  const startDate = parseDateString(weekStartDate);

  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    return formatDateString(date);
  });
}

export function addDaysToDate(date: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new Error(`더할 일수는 정수여야 합니다: ${days}`);
  }

  const parsedDate = parseDateString(date);
  parsedDate.setUTCDate(parsedDate.getUTCDate() + days);

  return formatDateString(parsedDate);
}

export function isCapturedWithinEntry(capturedAt: string, entry: TimeRangeEntryLike): boolean {
  const captured = parseCapturedAt(capturedAt);

  if (!captured) {
    return false;
  }

  const validation = validateDiaryTimeRange(entry.startTime, entry.endTime);

  if (!validation.isValid) {
    return false;
  }

  const capturedOffsetMinutes = getCapturedOffsetMinutes(captured, entry.date);

  if (capturedOffsetMinutes === null) {
    return false;
  }

  return (
    capturedOffsetMinutes >= validation.startMinutes &&
    capturedOffsetMinutes < validation.endMinutes
  );
}

function tryParseTime(time: string): number | null {
  try {
    return parseTimeToMinutes(time);
  } catch {
    return null;
  }
}

function tryParseDiaryTime(time: string): number | null {
  try {
    return parseDiaryTimeToMinutes(time);
  } catch {
    return null;
  }
}

function getCapturedOffsetMinutes(
  captured: { date: string; minutes: number },
  entryDate: string,
): number | null {
  try {
    const entryDateValue = parseDateString(entryDate);
    const capturedDateValue = parseDateString(captured.date);
    const dayOffset = Math.round(
      (capturedDateValue.getTime() - entryDateValue.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (dayOffset < 0 || dayOffset > 1) {
      return null;
    }

    return dayOffset * MINUTES_PER_DAY + captured.minutes;
  } catch {
    return null;
  }
}

function parseDateString(date: string): Date {
  const match = DATE_PATTERN.exec(date);

  if (!match) {
    throw new Error(`잘못된 날짜 형식입니다: ${date}`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error(`잘못된 날짜 값입니다: ${date}`);
  }

  return parsedDate;
}

function formatDateString(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function parseCapturedAt(capturedAt: string): { date: string; minutes: number } | null {
  const match = CAPTURED_AT_PATTERN.exec(capturedAt);

  if (!match) {
    return null;
  }

  const date = match[1];
  const hourText = match[2];
  const minuteText = match[3];

  if (!date || !hourText || !minuteText) {
    return null;
  }

  try {
    parseDateString(date);
    return {
      date,
      minutes: parseTimeToMinutes(`${hourText}:${minuteText}`),
    };
  } catch {
    return null;
  }
}
