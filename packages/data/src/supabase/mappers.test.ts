import { describe, expect, it } from 'vitest';

import { mapCategoryRow, mapTimeEntryRow, mapWeekReviewRow } from './mappers';

describe('Supabase row mappers', () => {
  it('maps category rows to domain categories', () => {
    expect(
      mapCategoryRow({
        id: 'category-1',
        user_id: 'user-1',
        name: '공부',
        color: '#2563EB',
        emoji: 'book',
        weekly_goal_minutes: 600,
        sort_order: 10,
        is_archived: false,
        created_at: '2026-05-07T00:00:00.000Z',
        updated_at: '2026-05-07T00:00:00.000Z',
        deleted_at: null,
      }),
    ).toEqual({
      id: 'category-1',
      userId: 'user-1',
      name: '공부',
      color: '#2563EB',
      emoji: 'book',
      weeklyGoalMinutes: 600,
      sortOrder: 10,
      isArchived: false,
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:00:00.000Z',
      deletedAt: null,
    });
  });

  it('maps time entry rows to domain time entries', () => {
    expect(
      mapTimeEntryRow({
        id: 'entry-1',
        user_id: 'user-1',
        date: '2026-05-07',
        start_time: '09:00',
        end_time: '10:00',
        category_id: 'category-1',
        note: '',
        source: 'manual',
        created_at: '2026-05-07T00:00:00.000Z',
        updated_at: '2026-05-07T00:00:00.000Z',
        deleted_at: null,
      }),
    ).toEqual({
      id: 'entry-1',
      userId: 'user-1',
      date: '2026-05-07',
      startTime: '09:00',
      endTime: '10:00',
      categoryId: 'category-1',
      note: '',
      source: 'manual',
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:00:00.000Z',
      deletedAt: null,
    });
  });

  it('maps week review rows to domain week reviews', () => {
    expect(
      mapWeekReviewRow({
        id: 'review-1',
        user_id: 'user-1',
        week_start_date: '2026-05-04',
        summary: '요약',
        wins: '',
        problems: '',
        next_week_focus: '',
        created_at: '2026-05-07T00:00:00.000Z',
        updated_at: '2026-05-07T00:00:00.000Z',
        deleted_at: null,
      }),
    ).toEqual({
      id: 'review-1',
      userId: 'user-1',
      weekStartDate: '2026-05-04',
      summary: '요약',
      wins: '',
      problems: '',
      nextWeekFocus: '',
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:00:00.000Z',
      deletedAt: null,
    });
  });
});
