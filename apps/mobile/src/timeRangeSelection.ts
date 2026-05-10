import {
  createWeekGridTimeRangeSelection,
  validateTimeRange,
  type WeekGridBlock,
  type WeekGridTimeRangeSelection,
} from '@weekly/domain';

export type TimeRangeSelectionInputResult =
  | {
      isValid: true;
      selection: WeekGridTimeRangeSelection;
    }
  | {
      isValid: false;
      errorMessage: string;
    };

const INVALID_TIME_RANGE_MESSAGE = '시간은 10분 단위이며 종료 시간이 시작 시간보다 늦어야 합니다.';
const OUT_OF_VISIBLE_RANGE_MESSAGE = '현재 표시 범위 안의 시간을 입력해주세요.';

export function createTimeRangeSelectionFromSlot(
  blocks: readonly WeekGridBlock[],
  slotIndex: number,
): WeekGridTimeRangeSelection | null {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= blocks.length) {
    return null;
  }

  try {
    return createWeekGridTimeRangeSelection(blocks, slotIndex, slotIndex);
  } catch {
    return null;
  }
}

export function expandTimeRangeSelection(
  blocks: readonly WeekGridBlock[],
  selection: WeekGridTimeRangeSelection,
  edge: 'start' | 'end',
  deltaSlots: number,
): WeekGridTimeRangeSelection | null {
  const nextStartSlotIndex =
    edge === 'start' ? selection.startSlotIndex + deltaSlots : selection.startSlotIndex;
  const nextEndSlotIndex =
    edge === 'end' ? selection.endSlotIndex + deltaSlots : selection.endSlotIndex;

  if (
    nextStartSlotIndex < 0 ||
    nextEndSlotIndex >= blocks.length ||
    nextStartSlotIndex > nextEndSlotIndex
  ) {
    return null;
  }

  try {
    return createWeekGridTimeRangeSelection(blocks, nextStartSlotIndex, nextEndSlotIndex);
  } catch {
    return null;
  }
}

export function createTimeRangeSelectionFromTimes(
  blocks: readonly WeekGridBlock[],
  startTime: string,
  endTime: string,
): TimeRangeSelectionInputResult {
  const validation = validateTimeRange(startTime, endTime);

  if (!validation.isValid) {
    return {
      isValid: false,
      errorMessage: INVALID_TIME_RANGE_MESSAGE,
    };
  }

  const startSlotIndex = blocks.findIndex((block) => block.startTime === startTime);
  const endSlotIndex = blocks.findIndex((block) => block.endTime === endTime);

  if (startSlotIndex === -1 || endSlotIndex === -1) {
    return {
      isValid: false,
      errorMessage: OUT_OF_VISIBLE_RANGE_MESSAGE,
    };
  }

  try {
    return {
      isValid: true,
      selection: createWeekGridTimeRangeSelection(blocks, startSlotIndex, endSlotIndex),
    };
  } catch {
    return {
      isValid: false,
      errorMessage: INVALID_TIME_RANGE_MESSAGE,
    };
  }
}
