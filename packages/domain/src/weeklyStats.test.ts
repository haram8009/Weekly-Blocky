import { describe, expect, it } from 'vitest';

import {
  createReviewChartData,
  createWeeklyStats,
  type ReviewChartCategoryLike,
  type ReviewChartEntryLike,
} from './weeklyStats';

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

  it('groups totals by repeated category name and emoji keys', () => {
    const stats = createWeeklyStats({
      weekStartDate: '2026-05-04',
      categories: [
        ...categories,
        {
          id: 'deep-work',
          name: '주요 업무',
          emoji: '💼',
          color: '#14B8A6',
        },
      ],
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
          endTime: '11:30',
          categoryId: 'deep-work',
          deletedAt: null,
        },
        {
          date: '2026-05-06',
          startTime: '12:00',
          endTime: '12:30',
          categoryId: 'meeting',
          deletedAt: null,
        },
      ],
    });

    expect(stats.totalsByName.find((total) => total.key === '주요 업무')).toMatchObject({
      minutes: 150,
      ratio: 83,
    });
    expect(stats.totalsByEmoji.find((total) => total.key === '💼')).toMatchObject({
      minutes: 150,
      ratio: 83,
    });
    expect(stats.totalsByColor.map(({ key, minutes }) => ({ key, minutes }))).toEqual([
      { key: '#14B8A6', minutes: 90 },
      { key: '#2563EB', minutes: 90 },
    ]);
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

describe('createReviewChartData', () => {
  const reviewCategories: ReviewChartCategoryLike[] = [
    { id: 'work', name: '업무', emoji: '💼', color: '#2563EB' },
    { id: 'meeting', name: '회의', emoji: '🗓️', color: '#2563EB' },
    { id: 'exercise', name: '운동', emoji: '🏃', color: '#16A34A' },
    { id: 'waste', name: '낭비한 시간', emoji: '🌀', color: '#DC2626' },
  ];
  const reviewEntries: ReviewChartEntryLike[] = [
    { date: '2026-05-18', startTime: '09:00', endTime: '11:00', categoryId: 'work' },
    { date: '2026-05-18', startTime: '11:00', endTime: '12:00', categoryId: 'meeting' },
    { date: '2026-05-18', startTime: '19:00', endTime: '20:00', categoryId: 'exercise' },
    { date: '2026-05-19', startTime: '21:00', endTime: '23:00', categoryId: 'waste' },
  ];

  it('groups review chart data by category color', () => {
    const chartData = createReviewChartData({
      entries: reviewEntries,
      categories: reviewCategories,
      weekStartDate: '2026-05-18',
    });

    expect(chartData.groups[0]).toMatchObject({
      color: '#2563EB',
      label: '업무 외 1개',
      categoryNames: ['업무', '회의'],
      totalMinutes: 180,
    });
    expect(chartData.groups[0]?.dailyPoints[0]).toMatchObject({
      date: '2026-05-18',
      minutes: 180,
      ratio: 75,
    });
  });

  it('creates daily donut segments for the selected weekday', () => {
    const chartData = createReviewChartData({
      entries: reviewEntries,
      categories: reviewCategories,
      weekStartDate: '2026-05-18',
    });

    expect(chartData.dailyBreakdowns[0]?.segments).toEqual([
      expect.objectContaining({ color: '#2563EB', minutes: 180, ratio: 75 }),
      expect.objectContaining({ color: '#16A34A', minutes: 60, ratio: 25 }),
    ]);
  });

  it('returns zero ratios for days without entries', () => {
    const chartData = createReviewChartData({
      entries: reviewEntries,
      categories: reviewCategories,
      weekStartDate: '2026-05-18',
    });

    expect(chartData.dailyBreakdowns[2]).toMatchObject({
      date: '2026-05-20',
      recordedMinutes: 0,
      segments: [],
    });
    expect(chartData.groups[0]?.dailyPoints[2]).toMatchObject({ minutes: 0, ratio: 0 });
  });

  it('combines groups after the top six into other', () => {
    const manyCategories = Array.from({ length: 8 }, (_, index) => ({
      id: `category-${index}`,
      name: `분류 ${index}`,
      emoji: '•',
      color: `#00000${index}`,
    }));
    const manyEntries = manyCategories.map((category, index) => ({
      date: '2026-05-18' as const,
      startTime: '09:00' as const,
      endTime: `${String(9 + index + 1).padStart(2, '0')}:00` as const,
      categoryId: category.id,
    }));

    const chartData = createReviewChartData({
      entries: manyEntries,
      categories: manyCategories,
      weekStartDate: '2026-05-18',
      maxGroups: 6,
    });

    expect(chartData.groups).toHaveLength(7);
    expect(chartData.groups.at(-1)).toMatchObject({
      color: '#64748B',
      label: '기타',
      categoryNames: ['분류 1', '분류 0'],
      totalMinutes: 180,
    });
  });

  it('keeps archived categories in review chart data', () => {
    const chartData = createReviewChartData({
      entries: [
        {
          date: '2026-05-18',
          startTime: '10:00',
          endTime: '11:00',
          categoryId: 'archived-rest',
        },
      ],
      categories,
      weekStartDate: '2026-05-18',
    });

    expect(chartData.groups[0]).toMatchObject({
      color: '#64748B',
      label: '보관 휴식',
      categoryNames: ['보관 휴식'],
      totalMinutes: 60,
      ratio: 100,
      peakDate: '2026-05-18',
      peakWeekdayLabel: '월',
    });
  });
});
