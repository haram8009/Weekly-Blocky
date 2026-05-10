import type {
  AppSettings,
  DateString,
  EntityId,
  TimeEntrySource,
  TimeString,
  TimestampString,
} from '@weekly/domain';

export type SupabaseUserProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseCategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  emoji: string;
  weekly_goal_minutes: number | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupabaseTimeEntryRow = {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  category_id: string;
  note: string;
  source: TimeEntrySource;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupabaseWeekReviewRow = {
  id: string;
  user_id: string;
  week_start_date: string;
  summary: string;
  wins: string;
  problems: string;
  next_week_focus: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupabaseSettingsRow = {
  id: string;
  user_id: string;
  week_starts_on: AppSettings['weekStartsOn'];
  visible_start_time: string;
  visible_end_time: string;
  use_full_day_view: boolean;
  photo_matching_enabled: boolean;
  thumbnail_sync_enabled: boolean;
  last_opened_week_start_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ListCategoriesOptions = {
  includeArchived?: boolean;
  includeDeleted?: boolean;
};

export type CreateCategoryInput = {
  id?: EntityId;
  name: string;
  color: string;
  emoji: string;
  weeklyGoalMinutes?: number | null;
  sortOrder?: number;
  now?: TimestampString;
};

export type CreateCategoryRepositoryInput = CreateCategoryInput;

export type UpdateCategoryInput = {
  id: EntityId;
  name?: string;
  color?: string;
  emoji?: string;
  weeklyGoalMinutes?: number | null;
  sortOrder?: number;
  now?: TimestampString;
};

export type UpdateCategoryRepositoryInput = UpdateCategoryInput;

export type ArchiveCategoryInput = {
  id: EntityId;
  now?: TimestampString;
};

export type ArchiveCategoryRepositoryInput = ArchiveCategoryInput;

export type CreateTimeEntryInput = {
  id?: EntityId;
  date: DateString;
  startTime: TimeString;
  endTime: TimeString;
  categoryId: EntityId;
  note?: string;
  source?: TimeEntrySource;
  now?: TimestampString;
};

export type CreateTimeEntryRepositoryInput = CreateTimeEntryInput;

export type UpdateTimeEntryInput = {
  id: EntityId;
  date?: DateString;
  startTime?: TimeString;
  endTime?: TimeString;
  categoryId?: EntityId;
  note?: string;
  source?: TimeEntrySource;
  now?: TimestampString;
};

export type UpdateTimeEntryRepositoryInput = UpdateTimeEntryInput;

export type DeleteTimeEntryInput = {
  id: EntityId;
  now?: TimestampString;
};

export type UpdateSettingsInput = {
  weekStartsOn?: AppSettings['weekStartsOn'];
  visibleStartTime?: TimeString;
  visibleEndTime?: TimeString;
  useFullDayView?: boolean;
  photoMatchingEnabled?: boolean;
  thumbnailSyncEnabled?: boolean;
  lastOpenedWeekStartDate?: DateString | null;
  now?: TimestampString;
};

export type UpsertWeekReviewInput = {
  id?: EntityId;
  weekStartDate: DateString;
  summary?: string;
  wins?: string;
  problems?: string;
  nextWeekFocus?: string;
  now?: TimestampString;
};
