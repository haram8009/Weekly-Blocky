import type { DateString, TimeString } from './index';
import { formatMinutesToTime, getDatesOfWeek, validateTimeRange } from './time';

export const WEEK_GRID_SLOT_MINUTES = 10;
export const DEFAULT_WEEK_GRID_START_TIME = '05:00';
export const DEFAULT_WEEK_GRID_END_TIME = '24:00';
export const FULL_DAY_WEEK_GRID_START_TIME = '00:00';
export const FULL_DAY_WEEK_GRID_END_TIME = '24:00';

export type WeekGridBlock = {
  id: string;
  date: DateString;
  dateIndex: number;
  slotIndex: number;
  startTime: TimeString;
  endTime: TimeString;
  startMinutes: number;
  endMinutes: number;
};

export type WeekGridDay = {
  date: DateString;
  dateIndex: number;
  blocks: WeekGridBlock[];
};

export type WeekGrid = {
  dates: DateString[];
  days: WeekGridDay[];
  visibleStartTime: TimeString;
  visibleEndTime: TimeString;
  blocksPerDay: number;
  totalBlockCount: number;
  useFullDayView: boolean;
};

export type BuildWeekGridOptions = {
  weekStartDate: DateString;
  useFullDayView?: boolean;
};

export function buildWeekGrid({
  weekStartDate,
  useFullDayView = false,
}: BuildWeekGridOptions): WeekGrid {
  const visibleStartTime = useFullDayView
    ? FULL_DAY_WEEK_GRID_START_TIME
    : DEFAULT_WEEK_GRID_START_TIME;
  const visibleEndTime = useFullDayView ? FULL_DAY_WEEK_GRID_END_TIME : DEFAULT_WEEK_GRID_END_TIME;
  const range = parseWeekGridRange(visibleStartTime, visibleEndTime);
  const dates = getDatesOfWeek(weekStartDate);
  const blocksPerDay = (range.endMinutes - range.startMinutes) / WEEK_GRID_SLOT_MINUTES;
  const days = dates.map((date, dateIndex) => ({
    date,
    dateIndex,
    blocks: buildDayBlocks(date, dateIndex, range.startMinutes, range.endMinutes),
  }));

  return {
    dates,
    days,
    visibleStartTime,
    visibleEndTime,
    blocksPerDay,
    totalBlockCount: blocksPerDay * dates.length,
    useFullDayView,
  };
}

function parseWeekGridRange(
  startTime: TimeString,
  endTime: TimeString,
): {
  startMinutes: number;
  endMinutes: number;
} {
  const validation = validateTimeRange(startTime, endTime);

  if (!validation.isValid) {
    throw new Error(
      `주간 그리드 표시 범위가 올바르지 않습니다: ${startTime}-${endTime} (${validation.errors.join(', ')})`,
    );
  }

  return {
    startMinutes: validation.startMinutes,
    endMinutes: validation.endMinutes,
  };
}

function buildDayBlocks(
  date: DateString,
  dateIndex: number,
  startMinutes: number,
  endMinutes: number,
): WeekGridBlock[] {
  const blocks: WeekGridBlock[] = [];

  for (let minutes = startMinutes; minutes < endMinutes; minutes += WEEK_GRID_SLOT_MINUTES) {
    const startTime = formatMinutesToTime(minutes);
    const endTime = formatMinutesToTime(minutes + WEEK_GRID_SLOT_MINUTES);

    blocks.push({
      id: `${date}:${startTime}`,
      date,
      dateIndex,
      slotIndex: blocks.length,
      startTime,
      endTime,
      startMinutes: minutes,
      endMinutes: minutes + WEEK_GRID_SLOT_MINUTES,
    });
  }

  return blocks;
}
