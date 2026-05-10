import type { Category, TimeEntry } from '@weekly/domain';
import { UTF8_BOM } from '@weekly/domain';
import { describe, expect, it } from 'vitest';

import { createWebTimeEntriesCsv } from './timeEntriesCsv';

const category: Category = {
  id: 'category-1',
  userId: 'user-1',
  name: '집중 개발',
  color: '#236C5C',
  emoji: '💻',
  weeklyGoalMinutes: null,
  sortOrder: 1,
  isArchived: false,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  deletedAt: null,
};

const baseEntry: TimeEntry = {
  id: 'entry-1',
  userId: 'user-1',
  date: '2026-05-04',
  startTime: '09:00',
  endTime: '10:00',
  categoryId: category.id,
  note: '메모',
  source: 'manual',
  createdAt: '2026-05-04T00:00:00.000Z',
  updatedAt: '2026-05-04T00:10:00.000Z',
  deletedAt: null,
};

describe('createWebTimeEntriesCsv', () => {
  it('웹 기록을 도메인 CSV 입력으로 매핑하고 사진은 개수만 포함한다', () => {
    const csv = createWebTimeEntriesCsv({
      entries: [baseEntry],
      categories: [category],
      photoCountsByEntryId: new Map([[baseEntry.id, 2]]),
    });
    const dataRows = csv.slice(UTF8_BOM.length).split('\n').slice(1);

    expect(dataRows).toEqual([
      [
        '2026-05-04',
        '09:00',
        '10:00',
        '60',
        '집중 개발',
        '#236C5C',
        '💻',
        '메모',
        'manual',
        '2',
        '2026-05-04T00:00:00.000Z',
        '2026-05-04T00:10:00.000Z',
      ].join(','),
    ]);
  });

  it('삭제된 기록은 제외하고 카테고리가 없으면 대체 값을 사용한다', () => {
    const csv = createWebTimeEntriesCsv({
      entries: [
        { ...baseEntry, categoryId: 'missing-category' },
        { ...baseEntry, id: 'deleted-entry', deletedAt: '2026-05-04T00:20:00.000Z' },
      ],
      categories: [],
      photoCountsByEntryId: new Map(),
    });
    const dataRows = csv.slice(UTF8_BOM.length).split('\n').slice(1);

    expect(dataRows).toHaveLength(1);
    expect(dataRows[0]).toContain('카테고리 없음,#64748B,•');
  });
});
