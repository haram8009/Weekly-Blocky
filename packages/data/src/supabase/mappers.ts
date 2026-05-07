import type { Category, TimeEntry, WeekReview } from '@weekly/domain';

import type { SupabaseCategoryRow, SupabaseTimeEntryRow, SupabaseWeekReviewRow } from './types';

export function mapCategoryRow(row: SupabaseCategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    emoji: row.emoji,
    weeklyGoalMinutes: row.weekly_goal_minutes,
    sortOrder: row.sort_order,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapTimeEntryRow(row: SupabaseTimeEntryRow): TimeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    categoryId: row.category_id,
    note: row.note,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapWeekReviewRow(row: SupabaseWeekReviewRow): WeekReview {
  return {
    id: row.id,
    userId: row.user_id,
    weekStartDate: row.week_start_date,
    summary: row.summary,
    wins: row.wins,
    problems: row.problems,
    nextWeekFocus: row.next_week_focus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
