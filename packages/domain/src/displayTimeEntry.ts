import type { DateString, TimeString } from './index';
import {
  addDaysToDate,
  formatDiaryMinutesToTime,
  parseDiaryTimeToMinutes,
  validateDiaryTimeRange,
} from './time';

const MINUTES_PER_DAY = 24 * 60;

export type DisplayTimeEntryInput = {
  entry: {
    date: DateString;
    startTime: TimeString;
    endTime: TimeString;
  };
  visibleStartTime: TimeString;
  visibleEndTime: TimeString;
};

export type DisplayTimeEntry = {
  displayDate: DateString;
  displayStartTime: TimeString;
  displayEndTime: TimeString;
};

export function createDisplayTimeEntry({
  entry,
  visibleStartTime,
  visibleEndTime,
}: DisplayTimeEntryInput): DisplayTimeEntry {
  const visibleRange = validateDiaryTimeRange(visibleStartTime, visibleEndTime);
  const entryRange = validateDiaryTimeRange(entry.startTime, entry.endTime);

  if (!visibleRange.isValid) {
    throw new Error(
      `표시 시간대가 올바르지 않습니다: ${visibleStartTime}-${visibleEndTime} (${visibleRange.errors.join(', ')})`,
    );
  }

  if (!entryRange.isValid) {
    throw new Error(
      `기록 시간대가 올바르지 않습니다: ${entry.startTime}-${entry.endTime} (${entryRange.errors.join(', ')})`,
    );
  }

  if (
    visibleRange.endMinutes > MINUTES_PER_DAY &&
    entryRange.startMinutes < visibleRange.startMinutes
  ) {
    return {
      displayDate: addDaysToDate(entry.date, -1),
      displayStartTime: formatDiaryMinutesToTime(entryRange.startMinutes + MINUTES_PER_DAY),
      displayEndTime: formatDiaryMinutesToTime(entryRange.endMinutes + MINUTES_PER_DAY),
    };
  }

  return {
    displayDate: entry.date,
    displayStartTime: entry.startTime,
    displayEndTime: entry.endTime,
  };
}
