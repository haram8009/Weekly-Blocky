export type EntityId = string;

/** YYYY-MM-DD local date string. */
export type DateString = string;

/** HH:mm local time string. */
export type TimeString = string;

/** Timestamp string used for createdAt, updatedAt, and deletedAt. */
export type TimestampString = string;

export type Weekday = 'monday' | 'sunday';

export type TimeEntrySource = 'manual' | 'template' | 'import';

export type PhotoMediaType = 'photo' | 'video';

export type PhotoMatchType = 'auto' | 'manual';

export type PhotoPermissionScope = 'all' | 'limited';

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncStatus = 'pending' | 'synced' | 'failed';

export type TimestampedEntity = {
  createdAt: TimestampString;
  updatedAt: TimestampString;
};

export type SoftDeletableEntity = TimestampedEntity & {
  deletedAt: TimestampString | null;
};

export type UserProfile = TimestampedEntity & {
  id: EntityId;
  email: string;
  displayName: string | null;
};

export type Category = SoftDeletableEntity & {
  id: EntityId;
  userId: EntityId;
  name: string;
  color: string;
  emoji: string;
  weeklyGoalMinutes: number | null;
  sortOrder: number;
  isArchived: boolean;
};

export type TimeEntry = SoftDeletableEntity & {
  id: EntityId;
  userId: EntityId;
  date: DateString;
  startTime: TimeString;
  endTime: TimeString;
  categoryId: EntityId;
  note: string;
  source: TimeEntrySource;
};

export type Template = SoftDeletableEntity & {
  id: EntityId;
  userId: EntityId;
  name: string;
  description: string;
  entries: TemplateEntry[];
};

export type TemplateEntry = {
  id: EntityId;
  startTime: TimeString;
  endTime: TimeString;
  categoryId: EntityId;
  note: string;
};

export type WeekReview = SoftDeletableEntity & {
  id: EntityId;
  userId: EntityId;
  weekStartDate: DateString;
  summary: string;
  wins: string;
  problems: string;
  nextWeekFocus: string;
};

export type PhotoReference = SoftDeletableEntity & {
  id: EntityId;
  userId: EntityId;
  entryId: EntityId | null;
  date: DateString;
  capturedAt: TimestampString;
  localAssetId: string;
  localUri: string | null;
  thumbnailLocalUri: string | null;
  thumbnailRemoteUrl: string | null;
  width: number | null;
  height: number | null;
  mediaType: PhotoMediaType;
  matchType: PhotoMatchType;
  isHidden: boolean;
  permissionScope: PhotoPermissionScope;
};

export type AppSettings = TimestampedEntity & {
  id: EntityId;
  userId: EntityId;
  weekStartsOn: Weekday;
  visibleStartTime: TimeString;
  visibleEndTime: TimeString;
  useFullDayView: boolean;
  photoMatchingEnabled: boolean;
  thumbnailSyncEnabled: boolean;
  lastOpenedWeekStartDate: DateString | null;
};

export type SyncState = {
  entityType: string;
  entityId: EntityId;
  operation: SyncOperation;
  status: SyncStatus;
  retryCount: number;
  lastError: string | null;
  updatedAt: TimestampString;
};

export * from './defaults';
export * from './entryOverlap';
export * from './photoMatcher';
export * from './time';
export * from './weekGrid';
