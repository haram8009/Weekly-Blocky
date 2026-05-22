import type { DateString, TimeString } from './index';
import { formatDiaryMinutesToTime, getDatesOfWeek, validateDiaryTimeRange } from './time';

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
  visibleStartTime?: TimeString;
  visibleEndTime?: TimeString;
};

export type WeekGridTimeRangeSelection = {
  date: DateString;
  startSlotIndex: number;
  endSlotIndex: number;
  startTime: TimeString;
  endTime: TimeString;
  blockCount: number;
};

export function buildWeekGrid({
  weekStartDate,
  useFullDayView = false,
  visibleStartTime: customVisibleStartTime,
  visibleEndTime: customVisibleEndTime,
}: BuildWeekGridOptions): WeekGrid {
  const visibleStartTime = useFullDayView
    ? FULL_DAY_WEEK_GRID_START_TIME
    : (customVisibleStartTime ?? DEFAULT_WEEK_GRID_START_TIME);
  const visibleEndTime = useFullDayView
    ? FULL_DAY_WEEK_GRID_END_TIME
    : (customVisibleEndTime ?? DEFAULT_WEEK_GRID_END_TIME);
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

export function createWeekGridTimeRangeSelection(
  blocks: readonly WeekGridBlock[],
  anchorSlotIndex: number,
  focusSlotIndex: number,
): WeekGridTimeRangeSelection {
  if (blocks.length === 0) {
    throw new Error('선택할 그리드 블록이 없습니다.');
  }

  const startSlotIndex = Math.min(anchorSlotIndex, focusSlotIndex);
  const endSlotIndex = Math.max(anchorSlotIndex, focusSlotIndex);
  const startBlock = blocks[startSlotIndex];
  const endBlock = blocks[endSlotIndex];

  if (!startBlock || !endBlock) {
    throw new Error(`선택 범위가 그리드 범위를 벗어났습니다: ${anchorSlotIndex}-${focusSlotIndex}`);
  }

  if (startBlock.date !== endBlock.date) {
    throw new Error(
      `선택 범위는 같은 날짜 안에 있어야 합니다: ${startBlock.date}-${endBlock.date}`,
    );
  }

  return {
    date: startBlock.date,
    startSlotIndex,
    endSlotIndex,
    startTime: startBlock.startTime,
    endTime: endBlock.endTime,
    blockCount: endSlotIndex - startSlotIndex + 1,
  };
}

function parseWeekGridRange(
  startTime: TimeString,
  endTime: TimeString,
): {
  startMinutes: number;
  endMinutes: number;
} {
  const validation = validateDiaryTimeRange(startTime, endTime);

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
    const startTime = formatDiaryMinutesToTime(minutes);
    const endTime = formatDiaryMinutesToTime(minutes + WEEK_GRID_SLOT_MINUTES);

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
