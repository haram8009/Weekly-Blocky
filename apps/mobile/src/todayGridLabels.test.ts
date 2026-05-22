import { describe, expect, it } from 'vitest';

import { formatTodayGridDateDividerLabel, formatTodayGridHourLabel } from './todayGridLabels';

describe('formatTodayGridHourLabel', () => {
  it('keeps same-day hour labels unchanged', () => {
    expect(formatTodayGridHourLabel('23:00')).toBe('23:00');
  });

  it('shows next-day hour labels without the next-day prefix', () => {
    expect(formatTodayGridHourLabel('24:00')).toBe('00:00');
    expect(formatTodayGridHourLabel('29:00')).toBe('05:00');
  });
});

describe('formatTodayGridDateDividerLabel', () => {
  it('formats the divider with the next-day month and day', () => {
    expect(formatTodayGridDateDividerLabel('2026-05-23')).toBe('5월 23일');
  });
});
