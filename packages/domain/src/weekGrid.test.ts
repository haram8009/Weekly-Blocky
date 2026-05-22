import { describe, expect, it } from 'vitest';

import { buildWeekGrid, createWeekGridTimeRangeSelection } from './weekGrid';

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

  it('사용자 설정 표시 범위의 10분 블록 데이터를 생성한다', () => {
    const grid = buildWeekGrid({
      weekStartDate: '2026-05-04',
      visibleStartTime: '06:00',
      visibleEndTime: '22:00',
    });

    expect(grid.useFullDayView).toBe(false);
    expect(grid.visibleStartTime).toBe('06:00');
    expect(grid.visibleEndTime).toBe('22:00');
    expect(grid.blocksPerDay).toBe(96);
    expect(grid.totalBlockCount).toBe(672);
    expect(grid.days[0]?.blocks[0]).toMatchObject({
      id: '2026-05-04:06:00',
      startTime: '06:00',
      endTime: '06:10',
      startMinutes: 360,
      endMinutes: 370,
    });
    expect(grid.days[0]?.blocks[95]).toMatchObject({
      startTime: '21:50',
      endTime: '22:00',
      startMinutes: 1310,
      endMinutes: 1320,
    });
  });

  it('전체 보기가 켜져 있으면 사용자 설정 표시 범위보다 전체 범위를 우선한다', () => {
    const grid = buildWeekGrid({
      weekStartDate: '2026-05-04',
      useFullDayView: true,
      visibleStartTime: '06:00',
      visibleEndTime: '22:00',
    });

    expect(grid.visibleStartTime).toBe('00:00');
    expect(grid.visibleEndTime).toBe('24:00');
    expect(grid.blocksPerDay).toBe(144);
  });

  it('다음날 05:00까지의 사용자 설정 표시 범위를 생성한다', () => {
    const grid = buildWeekGrid({
      weekStartDate: '2026-05-04',
      visibleStartTime: '05:00',
      visibleEndTime: '29:00',
    });

    expect(grid.visibleStartTime).toBe('05:00');
    expect(grid.visibleEndTime).toBe('29:00');
    expect(grid.blocksPerDay).toBe(144);
    expect(grid.days[0]?.blocks[113]).toMatchObject({
      startTime: '23:50',
      endTime: '24:00',
      startMinutes: 1430,
      endMinutes: 1440,
    });
    expect(grid.days[0]?.blocks[143]).toMatchObject({
      startTime: '28:50',
      endTime: '29:00',
      startMinutes: 1730,
      endMinutes: 1740,
    });
  });

  it('선택한 블록 범위를 10분 단위 시간 범위로 변환한다', () => {
    const grid = buildWeekGrid({ weekStartDate: '2026-05-04' });
    const blocks = grid.days[0]?.blocks ?? [];

    expect(createWeekGridTimeRangeSelection(blocks, 24, 29)).toEqual({
      date: '2026-05-04',
      startSlotIndex: 24,
      endSlotIndex: 29,
      startTime: '09:00',
      endTime: '10:00',
      blockCount: 6,
    });
  });

  it('선택 시작과 끝이 바뀌어도 올바른 시간 범위로 정렬한다', () => {
    const grid = buildWeekGrid({ weekStartDate: '2026-05-04' });
    const blocks = grid.days[0]?.blocks ?? [];

    expect(createWeekGridTimeRangeSelection(blocks, 29, 24)).toEqual({
      date: '2026-05-04',
      startSlotIndex: 24,
      endSlotIndex: 29,
      startTime: '09:00',
      endTime: '10:00',
      blockCount: 6,
    });
  });

  it('그리드 범위를 벗어난 선택은 거부한다', () => {
    const grid = buildWeekGrid({ weekStartDate: '2026-05-04' });
    const blocks = grid.days[0]?.blocks ?? [];

    expect(() => createWeekGridTimeRangeSelection(blocks, 0, 999)).toThrow();
  });
});
