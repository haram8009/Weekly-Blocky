import type {
  AppSettings,
  Category,
  DateString,
  PhotoReference,
  TimeEntry,
  UserProfile,
  WeekReview,
} from '@weekly/domain';
import { createDefaultAppSettings, getDatesOfWeek } from '@weekly/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireCurrentUser, requireCurrentUserId } from './auth';
import {
  createSupabaseMutationError,
  createSupabaseQueryError,
  SupabaseStorageError,
} from './errors';
import { createEntityId, createWeekReviewId } from './ids';
import {
  mapCategoryRow,
  mapPhotoReferenceRow,
  mapSettingsRow,
  mapTimeEntryRow,
  mapUserProfileRow,
  mapWeekReviewRow,
} from './mappers';
import type {
  ArchiveCategoryRepositoryInput,
  CreateCategoryRepositoryInput,
  CreateTimeEntryRepositoryInput,
  ListCategoriesOptions,
  SupabaseCategoryRow,
  SupabasePhotoReferenceRow,
  SupabaseSettingsRow,
  SupabaseTimeEntryRow,
  SupabaseUserProfileRow,
  SupabaseWeekReviewRow,
  UpdateCategoryRepositoryInput,
  UpdateSettingsInput,
  UpdateTimeEntryRepositoryInput,
  UploadThumbnailInput,
  UpsertPhotoReferenceInput,
  UpsertWeekReviewInput,
} from './types';

const READ_ERROR_MESSAGE = '서버 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
const WRITE_ERROR_MESSAGE =
  '서버에 저장하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.';
export const THUMBNAIL_STORAGE_BUCKET = 'thumbnailStorage';

export class SupabaseUserProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async upsertCurrentUserProfile(now = new Date().toISOString()): Promise<UserProfile> {
    const user = await requireCurrentUser(this.client);
    const email = user.email ?? '';
    const displayName =
      typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null;
    const { data, error } = await this.client
      .from('user_profiles')
      .upsert(
        {
          id: user.id,
          email,
          display_name: displayName,
          updated_at: now,
        },
        { onConflict: 'id' },
      )
      .select()
      .single();

    if (error) {
      throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
    }

    return mapUserProfileRow(data as SupabaseUserProfileRow);
  }
}

export class SupabasePhotoReferenceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async upsertPhotoReference(input: UpsertPhotoReferenceInput): Promise<PhotoReference> {
    const userId = await requireCurrentUserId(this.client);
    const now = input.now ?? new Date().toISOString();
    const { data, error } = await this.client
      .from('photo_references')
      .upsert(toPhotoReferenceUpsertPayload(input, userId, now), { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
    }

    return mapPhotoReferenceRow(data as SupabasePhotoReferenceRow);
  }
}

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

  async insertCategory(input: CreateCategoryRepositoryInput): Promise<Category> {
    const userId = await requireCurrentUserId(this.client);
    const now = input.now ?? new Date().toISOString();
    const { data, error } = await this.client
      .from('categories')
      .insert(toCategoryInsertPayload(input, userId, now))
      .select()
      .single();

    if (error) {
      throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
    }

    return mapCategoryRow(data as SupabaseCategoryRow);
  }

  async updateCategory(input: UpdateCategoryRepositoryInput): Promise<Category> {
    const userId = await requireCurrentUserId(this.client);
    const { id, now, ...changes } = input;
    const { data, error } = await this.client
      .from('categories')
      .update(toCategoryUpdatePayload(changes, now ?? new Date().toISOString()))
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
        '수정할 카테고리를 찾지 못했습니다. 서버 데이터를 새로고침한 뒤 다시 시도해주세요.',
        `Category not found: ${id}`,
      );
    }

    return mapCategoryRow(data as SupabaseCategoryRow);
  }

  async archiveCategory(input: ArchiveCategoryRepositoryInput): Promise<Category> {
    const userId = await requireCurrentUserId(this.client);
    const now = input.now ?? new Date().toISOString();
    const { data, error } = await this.client
      .from('categories')
      .update({
        is_archived: true,
        updated_at: now,
      })
      .eq('user_id', userId)
      .eq('id', input.id)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) {
      throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
    }

    if (!data) {
      throw new SupabaseStorageError(
        'NOT_FOUND',
        '보관할 카테고리를 찾지 못했습니다. 서버 데이터를 새로고침한 뒤 다시 시도해주세요.',
        `Category not found: ${input.id}`,
      );
    }

    return mapCategoryRow(data as SupabaseCategoryRow);
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

export class SupabaseSettingsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getSettings(): Promise<AppSettings | null> {
    const userId = await requireCurrentUserId(this.client);
    const { data, error } = await this.client
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw createSupabaseQueryError(READ_ERROR_MESSAGE, error);
    }

    return data ? mapSettingsRow(data as SupabaseSettingsRow) : null;
  }

  async ensureDefaultSettings(now = new Date().toISOString()): Promise<AppSettings> {
    const userId = await requireCurrentUserId(this.client);
    const existingSettings = await this.getSettings();

    if (existingSettings) {
      return existingSettings;
    }

    const defaultSettings = createDefaultAppSettings({ userId, now });
    const { data, error } = await this.client
      .from('settings')
      .insert(toSettingsInsertPayload(defaultSettings))
      .select()
      .maybeSingle();

    if (error) {
      if (isUniqueViolation(error)) {
        const concurrentSettings = await this.getSettings();

        if (concurrentSettings) {
          return concurrentSettings;
        }
      }

      throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
    }

    if (!data) {
      throw new SupabaseStorageError(
        'QUERY_FAILED',
        READ_ERROR_MESSAGE,
        'Settings insert returned no row.',
      );
    }

    return mapSettingsRow(data as SupabaseSettingsRow);
  }

  async updateSettings(input: UpdateSettingsInput): Promise<AppSettings> {
    const userId = await requireCurrentUserId(this.client);
    const now = input.now ?? new Date().toISOString();

    await this.ensureDefaultSettings(now);

    const { data, error } = await this.client
      .from('settings')
      .update(toSettingsUpdatePayload(input, now))
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
    }

    if (!data) {
      throw new SupabaseStorageError(
        'QUERY_FAILED',
        READ_ERROR_MESSAGE,
        'Settings update returned no row.',
      );
    }

    return mapSettingsRow(data as SupabaseSettingsRow);
  }
}

export function createSupabaseRepositories(client: SupabaseClient) {
  return {
    userProfiles: new SupabaseUserProfileRepository(client),
    categories: new SupabaseCategoryRepository(client),
    timeEntries: new SupabaseTimeEntryRepository(client),
    weekReviews: new SupabaseWeekReviewRepository(client),
    settings: new SupabaseSettingsRepository(client),
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

export function createCategory(
  client: SupabaseClient,
  input: CreateCategoryRepositoryInput,
): Promise<Category> {
  return new SupabaseCategoryRepository(client).insertCategory(input);
}

export function updateCategory(
  client: SupabaseClient,
  input: UpdateCategoryRepositoryInput,
): Promise<Category> {
  return new SupabaseCategoryRepository(client).updateCategory(input);
}

export function archiveCategory(
  client: SupabaseClient,
  input: ArchiveCategoryRepositoryInput,
): Promise<Category> {
  return new SupabaseCategoryRepository(client).archiveCategory(input);
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

export async function ensureCurrentUserBootstrapData(
  client: SupabaseClient,
): Promise<{ profile: UserProfile; settings: AppSettings }> {
  const now = new Date().toISOString();
  const profile = await new SupabaseUserProfileRepository(client).upsertCurrentUserProfile(now);
  const settings = await new SupabaseSettingsRepository(client).ensureDefaultSettings(now);

  return { profile, settings };
}

export function getSettings(client: SupabaseClient): Promise<AppSettings | null> {
  return new SupabaseSettingsRepository(client).getSettings();
}

export function ensureDefaultSettings(client: SupabaseClient): Promise<AppSettings> {
  return new SupabaseSettingsRepository(client).ensureDefaultSettings();
}

export function updateSettings(
  client: SupabaseClient,
  input: UpdateSettingsInput,
): Promise<AppSettings> {
  return new SupabaseSettingsRepository(client).updateSettings(input);
}

export function upsertPhotoReference(
  client: SupabaseClient,
  input: UpsertPhotoReferenceInput,
): Promise<PhotoReference> {
  return new SupabasePhotoReferenceRepository(client).upsertPhotoReference(input);
}

export async function uploadThumbnail(
  client: SupabaseClient,
  input: UploadThumbnailInput,
): Promise<string> {
  const userId = await requireCurrentUserId(client);
  const path = createThumbnailStoragePath(userId, input.photoReferenceId);
  const { error } = await client.storage.from(THUMBNAIL_STORAGE_BUCKET).upload(path, input.body, {
    cacheControl: input.cacheControl ?? '3600',
    contentType: input.contentType ?? 'image/jpeg',
    upsert: true,
  });

  if (error) {
    throw createSupabaseMutationError(WRITE_ERROR_MESSAGE, error);
  }

  return path;
}

export function createThumbnailStoragePath(userId: string, photoReferenceId: string): string {
  return `${userId}/${encodeURIComponent(photoReferenceId)}.jpg`;
}

function toCategoryInsertPayload(
  input: CreateCategoryRepositoryInput,
  userId: string,
  now: string,
) {
  return {
    id: input.id ?? createEntityId('category'),
    user_id: userId,
    name: normalizeRequiredCategoryText(input.name, 'name'),
    color: normalizeRequiredCategoryText(input.color, 'color'),
    emoji: normalizeRequiredCategoryText(input.emoji, 'emoji'),
    weekly_goal_minutes: normalizeWeeklyGoalMinutes(input.weeklyGoalMinutes),
    sort_order: normalizeSortOrder(input.sortOrder),
    is_archived: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function toSettingsInsertPayload(settings: AppSettings) {
  return {
    id: settings.id,
    user_id: settings.userId,
    week_starts_on: settings.weekStartsOn,
    visible_start_time: settings.visibleStartTime,
    visible_end_time: settings.visibleEndTime,
    use_full_day_view: settings.useFullDayView,
    photo_matching_enabled: settings.photoMatchingEnabled,
    thumbnail_sync_enabled: settings.thumbnailSyncEnabled,
    last_opened_week_start_date: settings.lastOpenedWeekStartDate,
    created_at: settings.createdAt,
    updated_at: settings.updatedAt,
  };
}

function toSettingsUpdatePayload(input: UpdateSettingsInput, updatedAt: string) {
  return {
    ...(input.weekStartsOn !== undefined ? { week_starts_on: input.weekStartsOn } : {}),
    ...(input.visibleStartTime !== undefined ? { visible_start_time: input.visibleStartTime } : {}),
    ...(input.visibleEndTime !== undefined ? { visible_end_time: input.visibleEndTime } : {}),
    ...(input.useFullDayView !== undefined ? { use_full_day_view: input.useFullDayView } : {}),
    ...(input.photoMatchingEnabled !== undefined
      ? { photo_matching_enabled: input.photoMatchingEnabled }
      : {}),
    ...(input.thumbnailSyncEnabled !== undefined
      ? { thumbnail_sync_enabled: input.thumbnailSyncEnabled }
      : {}),
    ...(input.lastOpenedWeekStartDate !== undefined
      ? { last_opened_week_start_date: input.lastOpenedWeekStartDate }
      : {}),
    updated_at: updatedAt,
  };
}

function toPhotoReferenceUpsertPayload(
  input: UpsertPhotoReferenceInput,
  userId: string,
  now: string,
) {
  return {
    id: input.id,
    user_id: userId,
    entry_id: input.entryId,
    date: input.date,
    captured_at: input.capturedAt,
    local_asset_id: input.localAssetId,
    thumbnail_remote_url: input.thumbnailRemoteUrl,
    width: input.width,
    height: input.height,
    media_type: input.mediaType,
    match_type: input.matchType,
    is_hidden: input.isHidden,
    permission_scope: input.permissionScope,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function toCategoryUpdatePayload(
  changes: Omit<UpdateCategoryRepositoryInput, 'id' | 'now'>,
  updatedAt: string,
) {
  return {
    ...(changes.name !== undefined
      ? { name: normalizeRequiredCategoryText(changes.name, 'name') }
      : {}),
    ...(changes.color !== undefined
      ? { color: normalizeRequiredCategoryText(changes.color, 'color') }
      : {}),
    ...(changes.emoji !== undefined
      ? { emoji: normalizeRequiredCategoryText(changes.emoji, 'emoji') }
      : {}),
    ...(changes.weeklyGoalMinutes !== undefined
      ? { weekly_goal_minutes: normalizeWeeklyGoalMinutes(changes.weeklyGoalMinutes) }
      : {}),
    ...(changes.sortOrder !== undefined
      ? { sort_order: normalizeSortOrder(changes.sortOrder) }
      : {}),
    updated_at: updatedAt,
  };
}

function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === '23505';
}

function normalizeRequiredCategoryText(value: string, fieldName: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new SupabaseStorageError(
      'VALIDATION_FAILED',
      '카테고리 이름, 색상, 이모지는 모두 입력해야 합니다.',
      `Category ${fieldName} is required.`,
    );
  }

  return normalizedValue;
}

function normalizeWeeklyGoalMinutes(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new SupabaseStorageError(
      'VALIDATION_FAILED',
      '주간 목표 시간은 0 이상의 정수 분 단위로 입력해야 합니다.',
      `Invalid weekly goal minutes: ${value}`,
    );
  }

  return value;
}

function normalizeSortOrder(value: number | undefined): number {
  if (value === undefined) {
    return 0;
  }

  if (!Number.isInteger(value)) {
    throw new SupabaseStorageError(
      'VALIDATION_FAILED',
      '카테고리 표시 순서는 정수로 입력해야 합니다.',
      `Invalid category sort order: ${value}`,
    );
  }

  return value;
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
