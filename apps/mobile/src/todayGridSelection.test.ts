import { describe, expect, it } from 'vitest';

import { getWeekGridSlotIndexFromPoint, type WeekGridSlotBounds } from './todayGridSelection';

const bounds: WeekGridSlotBounds = {
  pageX: 20,
  pageY: 40,
  width: 610,
  height: 528,
};

const baseOptions = {
  blockCount: 114,
  blocksPerRow: 6,
  bounds,
  columnGap: 2,
  rowGap: 4,
};

describe('getWeekGridSlotIndexFromPoint', () => {
  it('maps the first row first column to the 05:00 slot', () => {
    expect(
      getWeekGridSlotIndexFromPoint({
        ...baseOptions,
        point: { pageX: 70, pageY: 52 },
      }),
    ).toBe(0);
  });

  it('maps the first row last column to the 05:50 slot', () => {
    expect(
      getWeekGridSlotIndexFromPoint({
        ...baseOptions,
        point: { pageX: 580, pageY: 52 },
      }),
    ).toBe(5);
  });

  it('maps the second row first column to the 06:00 slot', () => {
    expect(
      getWeekGridSlotIndexFromPoint({
        ...baseOptions,
        point: { pageX: 70, pageY: 80 },
      }),
    ).toBe(6);
  });

  it('maps a middle row and column to its 10 minute slot', () => {
    expect(
      getWeekGridSlotIndexFromPoint({
        ...baseOptions,
        point: { pageX: 376, pageY: 136 },
      }),
    ).toBe(21);
  });

  it('maps the last block to the 23:50 slot', () => {
    expect(
      getWeekGridSlotIndexFromPoint({
        ...baseOptions,
        point: { pageX: 580, pageY: 556 },
      }),
    ).toBe(113);
  });

  it('keeps early gap points on the preceding slot', () => {
    expect(
      getWeekGridSlotIndexFromPoint({
        ...baseOptions,
        point: { pageX: 121, pageY: 65 },
      }),
    ).toBe(0);
  });

  it('moves late gap points to the next slot', () => {
    expect(
      getWeekGridSlotIndexFromPoint({
        ...baseOptions,
        point: { pageX: 121.5, pageY: 67.5 },
      }),
    ).toBe(7);
  });

  it('clamps off-grid movement to the nearest valid slot', () => {
    expect(
      getWeekGridSlotIndexFromPoint({
        ...baseOptions,
        point: { pageX: 2000, pageY: 2000 },
      }),
    ).toBe(113);
  });
});
