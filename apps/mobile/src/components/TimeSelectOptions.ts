import { formatDiaryMinutesToTime, type TimeString, type WeekGridBlock } from '@weekly/domain';

export type TimeHourOption = string;
export type TimeMinuteOption = string;

export function createTimeHourOptions(): TimeHourOption[] {
  return Array.from({ length: 30 }, (_, index) => String(index).padStart(2, '0'));
}

export function createTimeMinuteOptions(): TimeMinuteOption[] {
  return ['00', '10', '20', '30', '40', '50'];
}

export function createDiaryTimeOptions(): TimeString[] {
  const options: TimeString[] = [];

  for (let minutes = 0; minutes <= 29 * 60; minutes += 10) {
    options.push(formatDiaryMinutesToTime(minutes));
  }

  return options;
}

export function createTimeOptionsFromBlocks(
  blocks: readonly WeekGridBlock[],
  edge: 'start' | 'end',
): TimeString[] {
  return blocks.map((block) => (edge === 'start' ? block.startTime : block.endTime));
}
