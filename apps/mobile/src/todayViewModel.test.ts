import { describe, expect, it } from 'vitest';

import {
  createCategoryPaletteItems,
  createDailyEntryListItems,
  createDailySummary,
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
