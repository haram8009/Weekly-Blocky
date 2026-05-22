import { buildWeekGrid } from '@weekly/domain';
import { describe, expect, it } from 'vitest';

import {
  createDiaryTimeOptions,
  createTimeHourOptions,
  createTimeMinuteOptions,
  createTimeOptionsFromBlocks,
} from './TimeSelectOptions';

describe('createTimeHourOptions', () => {
  it('creates hour choices from 00 through 29', () => {
    const options = createTimeHourOptions();

    expect(options[0]).toBe('00');
    expect(options[1]).toBe('01');
    expect(options.at(-1)).toBe('29');
    expect(options).toHaveLength(30);
  });
});

describe('createTimeMinuteOptions', () => {
  it('creates 10 minute choices from 00 through 50', () => {
    expect(createTimeMinuteOptions()).toEqual(['00', '10', '20', '30', '40', '50']);
  });
});

describe('createDiaryTimeOptions', () => {
  it('creates 10 minute options from midnight through 29:00', () => {
    const options = createDiaryTimeOptions();

    expect(options[0]).toBe('00:00');
    expect(options[1]).toBe('00:10');
    expect(options.at(-1)).toBe('29:00');
    expect(options).toHaveLength(175);
  });
});

describe('createTimeOptionsFromBlocks', () => {
  it('uses block start times for start options and block end times for end options', () => {
    const blocks =
      buildWeekGrid({
        weekStartDate: '2026-05-04',
        visibleStartTime: '06:00',
        visibleEndTime: '07:00',
      }).days[0]?.blocks ?? [];

    expect(createTimeOptionsFromBlocks(blocks, 'start')).toEqual([
      '06:00',
      '06:10',
      '06:20',
      '06:30',
      '06:40',
      '06:50',
    ]);
    expect(createTimeOptionsFromBlocks(blocks, 'end')).toEqual([
      '06:10',
      '06:20',
      '06:30',
      '06:40',
      '06:50',
      '07:00',
    ]);
  });
});
