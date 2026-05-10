import { describe, expect, it } from 'vitest';

import {
  createRecordedDateSet,
  isMondayWeekStartDate,
  resolveInitialWeekStartDate,
} from './weekViewModel';

describe('isMondayWeekStartDate', () => {
  it('accepts a valid Monday week start date', () => {
    expect(isMondayWeekStartDate('2026-05-04')).toBe(true);
  });

  it('rejects non-Monday dates', () => {
    expect(isMondayWeekStartDate('2026-05-05')).toBe(false);
  });

  it('rejects invalid date strings', () => {
    expect(isMondayWeekStartDate('2026-02-31')).toBe(false);
    expect(isMondayWeekStartDate(null)).toBe(false);
  });
});

describe('resolveInitialWeekStartDate', () => {
  it('uses the saved week start date when it is valid', () => {
    expect(
      resolveInitialWeekStartDate({
        lastOpenedWeekStartDate: '2026-04-27',
        todayDate: '2026-05-10',
      }),
    ).toBe('2026-04-27');
  });

  it('falls back to the current week when the saved date is invalid', () => {
    expect(
      resolveInitialWeekStartDate({
        lastOpenedWeekStartDate: '2026-05-08',
        todayDate: '2026-05-10',
      }),
    ).toBe('2026-05-04');
  });
});

describe('createRecordedDateSet', () => {
  it('returns unique dates that still have active entries', () => {
    const recordedDates = createRecordedDateSet([
      { date: '2026-05-04', deletedAt: null },
      { date: '2026-05-04', deletedAt: null },
      { date: '2026-05-05', deletedAt: '2026-05-06T00:00:00.000Z' },
      { date: '2026-05-06', deletedAt: null },
    ]);

    expect([...recordedDates]).toEqual(['2026-05-04', '2026-05-06']);
  });
});
