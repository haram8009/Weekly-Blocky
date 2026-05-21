import { describe, expect, it } from 'vitest';

import {
  createCalendarMonth,
  createCategoryPaletteItems,
  createDailyEntryListItems,
  createDailySummary,
  createWeekCalendarRows,
  createWeekDateItems,
  formatDuration,
  resolveSelectedDate,
} from './todayViewModel';

const categories = [
  {
    id: 'work',
    name: '주요 업무',
    emoji: '💼',
    color: '#2563EB',
  },
  {
    id: 'rest',
    name: '휴식',
    emoji: '☕',
    color: '#64748B',
  },
];

const entries = [
  {
    id: 'entry-2',
    startTime: '10:00',
    endTime: '10:30',
    categoryId: 'rest',
    note: '',
    deletedAt: null,
  },
  {
    id: 'entry-1',
    startTime: '09:00',
    endTime: '10:00',
    categoryId: 'work',
    note: '문서 정리',
    deletedAt: null,
  },
  {
    id: 'entry-deleted',
    startTime: '11:00',
    endTime: '11:30',
    categoryId: 'work',
    note: '',
    deletedAt: '2026-05-10T00:00:00.000Z',
  },
];

describe('resolveSelectedDate', () => {
  it('uses a valid route date', () => {
    expect(resolveSelectedDate('2026-05-09', '2026-05-10')).toBe('2026-05-09');
  });

  it('falls back when the route date is invalid', () => {
    expect(resolveSelectedDate('2026-02-31', '2026-05-10')).toBe('2026-05-10');
    expect(resolveSelectedDate(undefined, '2026-05-10')).toBe('2026-05-10');
  });
});

describe('createCalendarMonth', () => {
  it('builds a monday-start 6-week month grid with selected and today markers', () => {
    const month = createCalendarMonth({
      visibleMonthDate: '2026-05-21',
      selectedDate: '2026-05-21',
      todayDate: '2026-05-10',
    });

    expect(month.monthLabel).toBe('2026년 5월');
    expect(month.weeks).toHaveLength(6);
    expect(month.weeks[0]?.map((item) => item.date)).toEqual([
      '2026-04-27',
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ]);
    expect(month.weeks[5]?.map((item) => item.date)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ]);
    expect(month.weeks.flat().find((item) => item.date === '2026-05-21')).toMatchObject({
      dayNumber: '21',
      isCurrentMonth: true,
      isSelected: true,
      isToday: false,
    });
    expect(month.weeks.flat().find((item) => item.date === '2026-05-10')).toMatchObject({
      dayNumber: '10',
      isCurrentMonth: true,
      isSelected: false,
      isToday: true,
    });
    expect(month.weeks.flat().find((item) => item.date === '2026-04-30')).toMatchObject({
      isCurrentMonth: false,
    });
  });
});

describe('createWeekDateItems', () => {
  it('builds monday-start week items for the selected date', () => {
    expect(
      createWeekDateItems({
        selectedDate: '2026-05-21',
        todayDate: '2026-05-20',
      }),
    ).toEqual([
      {
        date: '2026-05-18',
        weekdayLabel: '월',
        dayNumber: '18',
        isSelected: false,
        isToday: false,
      },
      {
        date: '2026-05-19',
        weekdayLabel: '화',
        dayNumber: '19',
        isSelected: false,
        isToday: false,
      },
      {
        date: '2026-05-20',
        weekdayLabel: '수',
        dayNumber: '20',
        isSelected: false,
        isToday: true,
      },
      {
        date: '2026-05-21',
        weekdayLabel: '목',
        dayNumber: '21',
        isSelected: true,
        isToday: false,
      },
      {
        date: '2026-05-22',
        weekdayLabel: '금',
        dayNumber: '22',
        isSelected: false,
        isToday: false,
      },
      {
        date: '2026-05-23',
        weekdayLabel: '토',
        dayNumber: '23',
        isSelected: false,
        isToday: false,
      },
      {
        date: '2026-05-24',
        weekdayLabel: '일',
        dayNumber: '24',
        isSelected: false,
        isToday: false,
      },
    ]);
  });
});

describe('createWeekCalendarRows', () => {
  it('builds one monday-start calendar row for the selected week', () => {
    expect(
      createWeekCalendarRows({
        selectedDate: '2026-05-21',
        todayDate: '2026-05-20',
      }),
    ).toEqual([
      [
        {
          date: '2026-05-18',
          dayNumber: '18',
          isCurrentMonth: true,
          isSelected: false,
          isToday: false,
        },
        {
          date: '2026-05-19',
          dayNumber: '19',
          isCurrentMonth: true,
          isSelected: false,
          isToday: false,
        },
        {
          date: '2026-05-20',
          dayNumber: '20',
          isCurrentMonth: true,
          isSelected: false,
          isToday: true,
        },
        {
          date: '2026-05-21',
          dayNumber: '21',
          isCurrentMonth: true,
          isSelected: true,
          isToday: false,
        },
        {
          date: '2026-05-22',
          dayNumber: '22',
          isCurrentMonth: true,
          isSelected: false,
          isToday: false,
        },
        {
          date: '2026-05-23',
          dayNumber: '23',
          isCurrentMonth: true,
          isSelected: false,
          isToday: false,
        },
        {
          date: '2026-05-24',
          dayNumber: '24',
          isCurrentMonth: true,
          isSelected: false,
          isToday: false,
        },
      ],
    ]);
  });
});

describe('createDailyEntryListItems', () => {
  it('sorts active entries by time and maps category labels', () => {
    expect(createDailyEntryListItems(entries, categories)).toEqual([
      {
        id: 'entry-1',
        timeRangeLabel: '09:00-10:00',
        categoryName: '주요 업무',
        categoryEmoji: '💼',
        categoryColor: '#2563EB',
        durationMinutes: 60,
        note: '문서 정리',
      },
      {
        id: 'entry-2',
        timeRangeLabel: '10:00-10:30',
        categoryName: '휴식',
        categoryEmoji: '☕',
        categoryColor: '#64748B',
        durationMinutes: 30,
        note: '',
      },
    ]);
  });
});

describe('createDailySummary', () => {
  it('calculates a daily summary draft from active entries', () => {
    expect(createDailySummary(entries, categories, 300)).toEqual({
      entryCount: 2,
      recordedMinutes: 90,
      unrecordedMinutes: 210,
      completionRate: 30,
      topCategoryLabel: '주요 업무',
      totalsByColor: [
        {
          key: '#2563EB',
          label: '#2563EB',
          color: '#2563EB',
          minutes: 60,
          ratio: 67,
        },
        {
          key: '#64748B',
          label: '#64748B',
          color: '#64748B',
          minutes: 30,
          ratio: 33,
        },
      ],
      totalsByName: [
        {
          key: '주요 업무',
          label: '주요 업무',
          color: '#2563EB',
          minutes: 60,
          ratio: 67,
        },
        {
          key: '휴식',
          label: '휴식',
          color: '#64748B',
          minutes: 30,
          ratio: 33,
        },
      ],
      totalsByEmoji: [
        {
          key: '💼',
          label: '💼 주요 업무',
          color: '#2563EB',
          minutes: 60,
          ratio: 67,
        },
        {
          key: '☕',
          label: '☕ 휴식',
          color: '#64748B',
          minutes: 30,
          ratio: 33,
        },
      ],
    });
  });
});

describe('createCategoryPaletteItems', () => {
  const paletteCategories = [
    {
      id: 'rest',
      name: '휴식',
      emoji: '☕',
      color: '#64748B',
      sortOrder: 20,
      isArchived: false,
      deletedAt: null,
    },
    {
      id: 'work',
      name: '주요 업무',
      emoji: '💼',
      color: '#2563EB',
      sortOrder: 10,
      isArchived: false,
      deletedAt: null,
    },
    {
      id: 'archived',
      name: '보관됨',
      emoji: '📦',
      color: '#94A3B8',
      sortOrder: 0,
      isArchived: true,
      deletedAt: null,
    },
  ];

  it('hides archived categories and sorts unused categories by display order', () => {
    expect(
      createCategoryPaletteItems(paletteCategories, []).map((category) => category.id),
    ).toEqual(['work', 'rest']);
  });

  it('moves recently used categories to the top', () => {
    expect(
      createCategoryPaletteItems(paletteCategories, [
        {
          categoryId: 'work',
          startTime: '09:00',
          endTime: '10:00',
          updatedAt: '2026-05-10T01:00:00.000Z',
          deletedAt: null,
        },
        {
          categoryId: 'rest',
          startTime: '10:00',
          endTime: '10:30',
          updatedAt: '2026-05-10T02:00:00.000Z',
          deletedAt: null,
        },
      ]).map((category) => category.id),
    ).toEqual(['rest', 'work']);
  });
});

describe('formatDuration', () => {
  it('formats minutes as compact Korean text', () => {
    expect(formatDuration(40)).toBe('40분');
    expect(formatDuration(60)).toBe('1시간');
    expect(formatDuration(90)).toBe('1시간 30분');
  });
});
