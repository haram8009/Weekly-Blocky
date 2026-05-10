import { describe, expect, it } from 'vitest';

import { buildWeekGrid } from './weekGrid';

describe('week grid utilities', () => {
  it('월요일 시작 7일과 기본 표시 범위의 10분 블록 데이터를 생성한다', () => {
    const grid = buildWeekGrid({ weekStartDate: '2026-05-04' });

    expect(grid.dates).toEqual([
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
    ]);
    expect(grid.visibleStartTime).toBe('05:00');
    expect(grid.visibleEndTime).toBe('24:00');
    expect(grid.blocksPerDay).toBe(114);
    expect(grid.totalBlockCount).toBe(798);
    expect(grid.days).toHaveLength(7);
    expect(grid.days[0]?.blocks).toHaveLength(114);
    expect(grid.days[0]?.blocks[0]).toMatchObject({
      id: '2026-05-04:05:00',
      date: '2026-05-04',
      dateIndex: 0,
      slotIndex: 0,
      startTime: '05:00',
      endTime: '05:10',
      startMinutes: 300,
      endMinutes: 310,
    });
    expect(grid.days[6]?.blocks[113]).toMatchObject({
      id: '2026-05-10:23:50',
      date: '2026-05-10',
      dateIndex: 6,
      slotIndex: 113,
      startTime: '23:50',
      endTime: '24:00',
      startMinutes: 1430,
      endMinutes: 1440,
    });
  });

  it('전체 보기 옵션에서는 00:00-24:00 기준 하루 144개 블록 데이터를 생성한다', () => {
    const grid = buildWeekGrid({ weekStartDate: '2026-05-04', useFullDayView: true });

    expect(grid.useFullDayView).toBe(true);
    expect(grid.visibleStartTime).toBe('00:00');
    expect(grid.visibleEndTime).toBe('24:00');
    expect(grid.blocksPerDay).toBe(144);
    expect(grid.totalBlockCount).toBe(1008);
    expect(grid.days[0]?.blocks[0]).toMatchObject({
      startTime: '00:00',
      endTime: '00:10',
      startMinutes: 0,
      endMinutes: 10,
    });
    expect(grid.days[0]?.blocks[143]).toMatchObject({
      startTime: '23:50',
      endTime: '24:00',
      startMinutes: 1430,
      endMinutes: 1440,
    });
  });
});
