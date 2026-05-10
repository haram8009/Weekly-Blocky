import { buildWeekGrid } from '@weekly/domain';
import { describe, expect, it } from 'vitest';

import {
  createTimeRangeSelectionFromSlot,
  createTimeRangeSelectionFromTimes,
  expandTimeRangeSelection,
} from './timeRangeSelection';

const blocks = buildWeekGrid({ weekStartDate: '2026-05-04' }).days[0]?.blocks ?? [];

describe('createTimeRangeSelectionFromSlot', () => {
  it('creates a 10 minute range from a tapped block', () => {
    expect(createTimeRangeSelectionFromSlot(blocks, 6)).toMatchObject({
      startSlotIndex: 6,
      endSlotIndex: 6,
      startTime: '06:00',
      endTime: '06:10',
      blockCount: 1,
    });
  });

  it('returns null when the slot is outside the visible grid', () => {
    expect(createTimeRangeSelectionFromSlot(blocks, -1)).toBeNull();
    expect(createTimeRangeSelectionFromSlot(blocks, blocks.length)).toBeNull();
  });
});

describe('expandTimeRangeSelection', () => {
  it('extends the end of a tapped selection by one slot', () => {
    const selection = createTimeRangeSelectionFromSlot(blocks, 6);

    expect(selection).not.toBeNull();
    expect(expandTimeRangeSelection(blocks, selection!, 'end', 1)).toMatchObject({
      startTime: '06:00',
      endTime: '06:20',
      blockCount: 2,
    });
  });

  it('extends the start of a selection by one slot', () => {
    const selection = createTimeRangeSelectionFromTimes(blocks, '06:00', '06:30');

    expect(selection.isValid).toBe(true);
    expect(
      selection.isValid ? expandTimeRangeSelection(blocks, selection.selection, 'start', -1) : null,
    ).toMatchObject({
      startTime: '05:50',
      endTime: '06:30',
      blockCount: 4,
    });
  });

  it('does not shrink past an empty range', () => {
    const selection = createTimeRangeSelectionFromSlot(blocks, 6);

    expect(selection).not.toBeNull();
    expect(expandTimeRangeSelection(blocks, selection!, 'start', 1)).toBeNull();
    expect(expandTimeRangeSelection(blocks, selection!, 'end', -1)).toBeNull();
  });
});

describe('createTimeRangeSelectionFromTimes', () => {
  it('creates a selection from valid direct input', () => {
    expect(createTimeRangeSelectionFromTimes(blocks, '09:00', '10:30')).toMatchObject({
      isValid: true,
      selection: {
        startTime: '09:00',
        endTime: '10:30',
        blockCount: 9,
      },
    });
  });

  it('rejects invalid or non-aligned direct input', () => {
    expect(createTimeRangeSelectionFromTimes(blocks, '09:05', '10:30')).toMatchObject({
      isValid: false,
    });
    expect(createTimeRangeSelectionFromTimes(blocks, '10:30', '09:00')).toMatchObject({
      isValid: false,
    });
  });

  it('rejects direct input outside the visible grid', () => {
    expect(createTimeRangeSelectionFromTimes(blocks, '04:00', '05:00')).toMatchObject({
      isValid: false,
    });
  });
});
