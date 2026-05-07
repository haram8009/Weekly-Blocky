import type { Category, DateString, TimeEntry, WeekReview } from '@weekly/domain';
import { getDatesOfWeek } from '@weekly/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireCurrentUserId } from './auth';
import {
  createSupabaseMutationError,
  createSupabaseQueryError,
  SupabaseStorageError,
} from './errors';
import { createEntityId, createWeekReviewId } from './ids';
import { mapCategoryRow, mapTimeEntryRow, mapWeekReviewRow } from './mappers';
import type {
  CreateTimeEntryRepositoryInput,
  ListCategoriesOptions,
  SupabaseCategoryRow,
  SupabaseTimeEntryRow,
  SupabaseWeekReviewRow,
  UpdateTimeEntryRepositoryInput,
  UpsertWeekReviewInput,
} from './types';

const READ_ERROR_MESSAGE = '서버 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
const WRITE_ERROR_MESSAGE = '서버에 저장하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.';

export class SupabaseCategoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listCategories(options: ListCategoriesOptions = {}): Promise<Category[]> {
    const userId = await requireCurrentUserId(this.client);
    let query = this.client
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!options.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    if (options.includeArchived === false) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    if (error) {
      throw createSupabaseQueryError(READ_ERROR_MESSAGE, error);
    }

    return ((data ?? []) as SupabaseCategoryRow[]).map(mapCategoryRow);
  }

  async listActiveCategories(): Promise<Category[]> {
    return this.listCategories({ includeArchived: false });
  }

  async getCategoryById(id: string): Promise<Category | null> {
    const userId = await requireCurrentUserId(this.client);
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw createSupabaseQueryError(READ_ERROR_MESSAGE, error);
    }

    return data ? mapCategoryRow(data as SupabaseCategoryRow) : null;
  }
}

export class SupabaseTimeEntryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getTimeEntryById(id: string): Promise<TimeEntry | null> {
    const userId = await requireCurrentUserId(this.client);
    const { data, error } = await this.client
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw createSupabaseQueryError(READ_ERROR_MESSAGE, error);
    }

    return data ? mapTimeEntryRow(data as SupabaseTimeEntryRow) : null;
  }

  async listTimeEntriesByDate(date: DateString): Promise<TimeEntry[]> {
    const userId = await requireCurrentUserId(this.client);
    const { data, error } = await this.client
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .is('deleted_at', null)
      .order('start_time', { ascending: true });

    if (error) {
      throw createSupabaseQueryError(READ_ERROR_MESSAGE, error);
    }

    return ((data ?? []) as SupabaseTimeEntryRow[]).map(mapTimeEntryRow);
  }

  async listTimeEntriesByWeek(weekStartDate: DateString): Promise<TimeEntry[]> {
    const userId = await requireCurrentUserId(this.client);
    const weekDates = getDatesOfWeek(weekStartDate);
    const weekEndDate = weekDates[weekDates.length - 1];

    if (!weekEndDate) {
      throw new SupabaseStorageError(
        'VALIDATION_FAILED',
        '주간 기록 조회 기준 날짜가 올바르지 않습니다.',
        'Week end date could not be calculated.',
      );
    }

    const { data, error } = await this.client
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', weekStartDate)
      .lte('date', weekEndDate)
      .is('deleted_at', null)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      throw createSupabaseQueryError(READ_ERROR_MESSAGE, error);
    }

    return ((data ?? []) as SupabaseTimeEntryRow[]).map(mapTimeEntryRow);
  }

  async insertTimeEntry(input: CreateTimeEntryRepositoryInput): Promise<TimeEntry> {
    const userId = await requireCurrentUserId(this.client);
    const now = input.now ?? new Date().toISOString();
    const { data, error } = await this.client
      .from('time_entries')
      .insert({
        id: input.id ?? createEntityId('timeEntry'),
        user_id: userId,
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        category_id: input.categoryId,
        note: input.note ?? '',
        source: input.source ?? 'manual',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .select()
      .single();

    if (error) {
      throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
    }

    return mapTimeEntryRow(data as SupabaseTimeEntryRow);
  }

  async updateTimeEntry(input: UpdateTimeEntryRepositoryInput): Promise<TimeEntry> {
    const userId = await requireCurrentUserId(this.client);
    const { id, now, ...changes } = input;
    const updatePayload = toTimeEntryUpdatePayload(changes, now ?? new Date().toISOString());
    const { data, error } = await this.client
      .from('time_entries')
      .update(updatePayload)
      .eq('user_id', userId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) {
      throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
    }

    if (!data) {
      throw new SupabaseStorageError(
        'NOT_FOUND',
        '수정할 기록을 찾지 못했습니다. 서버 데이터를 새로고침한 뒤 다시 시도해주세요.',
        `Time entry not found: ${id}`,
      );
    }

    return mapTimeEntryRow(data as SupabaseTimeEntryRow);
  }

  async softDeleteTimeEntry(id: string, now = new Date().toISOString()): Promise<TimeEntry> {
    const userId = await requireCurrentUserId(this.client);
    const { data, error } = await this.client
      .from('time_entries')
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq('user_id', userId)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) {
      throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
    }

    if (!data) {
      throw new SupabaseStorageError(
        'NOT_FOUND',
        '삭제할 기록을 찾지 못했습니다. 서버 데이터를 새로고침한 뒤 다시 시도해주세요.',
        `Time entry not found: ${id}`,
      );
    }

    return mapTimeEntryRow(data as SupabaseTimeEntryRow);
  }
}

export class SupabaseWeekReviewRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getWeekReviewByWeekStartDate(weekStartDate: DateString): Promise<WeekReview | null> {
    const userId = await requireCurrentUserId(this.client);
    const { data, error } = await this.client
      .from('week_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw createSupabaseQueryError(READ_ERROR_MESSAGE, error);
    }

    return data ? mapWeekReviewRow(data as SupabaseWeekReviewRow) : null;
  }

  async upsertWeekReview(input: UpsertWeekReviewInput): Promise<WeekReview> {
    const userId = await requireCurrentUserId(this.client);
    const now = input.now ?? new Date().toISOString();
    const existingReview = await this.getWeekReviewByWeekStartDate(input.weekStartDate);

    const query = existingReview
      ? this.client
          .from('week_reviews')
          .update({
            summary: input.summary ?? existingReview.summary,
            wins: input.wins ?? existingReview.wins,
            problems: input.problems ?? existingReview.problems,
            next_week_focus: input.nextWeekFocus ?? existingReview.nextWeekFocus,
            updated_at: now,
            deleted_at: null,
          })
          .eq('user_id', userId)
          .eq('week_start_date', input.weekStartDate)
      : this.client.from('week_reviews').insert({
          id: input.id ?? createWeekReviewId(userId, input.weekStartDate),
          user_id: userId,
          week_start_date: input.weekStartDate,
          summary: input.summary ?? '',
          wins: input.wins ?? '',
          problems: input.problems ?? '',
          next_week_focus: input.nextWeekFocus ?? '',
          created_at: now,
          updated_at: now,
          deleted_at: null,
        });

    const { data, error } = await query.select().single();

    if (error) {
      throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
    }

    return mapWeekReviewRow(data as SupabaseWeekReviewRow);
  }
}

export function createSupabaseRepositories(client: SupabaseClient) {
  return {
    categories: new SupabaseCategoryRepository(client),
    timeEntries: new SupabaseTimeEntryRepository(client),
    weekReviews: new SupabaseWeekReviewRepository(client),
  };
}

export function listCategories(
  client: SupabaseClient,
  options?: ListCategoriesOptions,
): Promise<Category[]> {
  return new SupabaseCategoryRepository(client).listCategories(options);
}

export function listActiveCategories(client: SupabaseClient): Promise<Category[]> {
  return new SupabaseCategoryRepository(client).listActiveCategories();
}

export function getCategoryById(client: SupabaseClient, id: string): Promise<Category | null> {
  return new SupabaseCategoryRepository(client).getCategoryById(id);
}

export function getWeekReviewByWeekStartDate(
  client: SupabaseClient,
  weekStartDate: DateString,
): Promise<WeekReview | null> {
  return new SupabaseWeekReviewRepository(client).getWeekReviewByWeekStartDate(weekStartDate);
}

export function upsertWeekReview(
  client: SupabaseClient,
  input: UpsertWeekReviewInput,
): Promise<WeekReview> {
  return new SupabaseWeekReviewRepository(client).upsertWeekReview(input);
}

function toTimeEntryUpdatePayload(
  changes: Omit<UpdateTimeEntryRepositoryInput, 'id' | 'now'>,
  updatedAt: string,
) {
  return {
    ...(changes.date !== undefined ? { date: changes.date } : {}),
    ...(changes.startTime !== undefined ? { start_time: changes.startTime } : {}),
    ...(changes.endTime !== undefined ? { end_time: changes.endTime } : {}),
    ...(changes.categoryId !== undefined ? { category_id: changes.categoryId } : {}),
    ...(changes.note !== undefined ? { note: changes.note } : {}),
    ...(changes.source !== undefined ? { source: changes.source } : {}),
    updated_at: updatedAt,
  };
}
