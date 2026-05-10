import { describe, expect, it } from 'vitest';

import { createWeeklyStats } from './weeklyStats';

const categories = [
  {
    id: 'work',
    name: '주요 업무',
    emoji: '💼',
    color: '#2563EB',
  },
  {
    id: 'meeting',
    name: '회의',
    emoji: '🗓️',
    color: '#2563EB',
  },
  {
    id: 'archived-rest',
    name: '보관 휴식',
    emoji: '☕',
    color: '#64748B',
    isArchived: true,
  },
  {
    id: 'waste',
    name: '낭비한 시간',
    emoji: '🫠',
    color: '#EF4444',
  },
];

describe('createWeeklyStats', () => {
  it('calculates weekly totals by color, category name, and emoji', () => {
    const stats = createWeeklyStats({
      weekStartDate: '2026-05-04',
      categories,
      entries: [
        {
          date: '2026-05-04',
          startTime: '09:00',
          endTime: '10:00',
          categoryId: 'work',
          deletedAt: null,
        },
        {
          date: '2026-05-05',
          startTime: '10:00',
          endTime: '10:30',
          categoryId: 'meeting',
          deletedAt: null,
        },
        {
          date: '2026-05-06',
          startTime: '11:00',
          endTime: '11:40',
          categoryId: 'archived-rest',
          deletedAt: null,
        },
        {
          date: '2026-05-07',
          startTime: '12:00',
          endTime: '12:20',
          categoryId: 'waste',
          deletedAt: null,
        },
        {
          date: '2026-05-08',
          startTime: '13:00',
          endTime: '14:00',
          categoryId: 'work',
          deletedAt: '2026-05-09T00:00:00.000Z',
        },
        {
          date: '2026-05-11',
          startTime: '09:00',
          endTime: '10:00',
          categoryId: 'work',
          deletedAt: null,
        },
      ],
    });

    expect(stats.recordedMinutes).toBe(150);
    expect(stats.visibleRecordedMinutes).toBe(150);
    expect(stats.unrecordedMinutes).toBe(9_930);
    expect(stats.completionRate).toBe(1);
    expect(stats.wastedMinutes).toBe(20);
    expect(stats.totalsByColor).toEqual([
      {
        key: '#2563EB',
        label: '#2563EB',
        color: '#2563EB',
        minutes: 90,
        ratio: 60,
        isWaste: false,
      },
      {
        key: '#64748B',
        label: '#64748B',
        color: '#64748B',
        minutes: 40,
        ratio: 27,
        isWaste: false,
      },
      {
        key: '#EF4444',
        label: '#EF4444',
        color: '#EF4444',
        minutes: 20,
        ratio: 13,
        isWaste: true,
      },
    ]);
    expect(
      stats.totalsByName.map(({ key, minutes, isWaste }) => ({ key, minutes, isWaste })),
    ).toEqual([
      { key: '주요 업무', minutes: 60, isWaste: false },
      { key: '보관 휴식', minutes: 40, isWaste: false },
      { key: '회의', minutes: 30, isWaste: false },
      { key: '낭비한 시간', minutes: 20, isWaste: true },
    ]);
    expect(
      stats.totalsByEmoji.map(({ key, minutes, isWaste }) => ({ key, minutes, isWaste })),
    ).toEqual([
      { key: '💼', minutes: 60, isWaste: false },
      { key: '☕', minutes: 40, isWaste: false },
      { key: '🗓️', minutes: 30, isWaste: false },
      { key: '🫠', minutes: 20, isWaste: true },
    ]);
  });

  it('recalculates unrecorded time and completion rate from the visible time range', () => {
    const stats = createWeeklyStats({
      weekStartDate: '2026-05-04',
      visibleStartTime: '05:00',
      visibleEndTime: '06:00',
      categories,
      entries: [
        {
          date: '2026-05-04',
          startTime: '04:30',
          endTime: '05:30',
          categoryId: 'work',
          deletedAt: null,
        },
        {
          date: '2026-05-05',
          startTime: '05:30',
          endTime: '06:30',
          categoryId: 'meeting',
          deletedAt: null,
        },
        {
          date: '2026-05-06',
          startTime: '01:00',
          endTime: '02:00',
          categoryId: 'work',
          deletedAt: null,
        },
      ],
    });

    expect(stats.recordedMinutes).toBe(180);
    expect(stats.visibleRecordedMinutes).toBe(60);
    expect(stats.visibleMinutes).toBe(420);
    expect(stats.unrecordedMinutes).toBe(360);
    expect(stats.completionRate).toBe(14);
  });

  it('groups unknown categories under a fallback label', () => {
    const stats = createWeeklyStats({
      weekStartDate: '2026-05-04',
      categories,
      entries: [
        {
          date: '2026-05-04',
          startTime: '09:00',
          endTime: '09:30',
          categoryId: 'missing',
          deletedAt: null,
        },
      ],
    });

    expect(stats.totalsByName).toEqual([
      {
        key: '카테고리 없음',
        label: '카테고리 없음',
        color: '#64748B',
        minutes: 30,
        ratio: 100,
        isWaste: false,
      },
    ]);
  });
});
