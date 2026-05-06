export const LOCAL_DATABASE_NAME = 'weekly.db';
export const CURRENT_SCHEMA_VERSION = 1;
export const SCHEMA_VERSION_KEY = 'schemaVersion';

export const LOCAL_TABLE_NAMES = [
  'localMetadata',
  'categories',
  'timeEntries',
  'weekReviews',
  'photoReferences',
  'settings',
  'syncState',
] as const;

export type LocalTableName = (typeof LOCAL_TABLE_NAMES)[number];

export const CREATE_INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS localMetadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  emoji TEXT NOT NULL,
  weeklyGoalMinutes INTEGER,
  sortOrder INTEGER NOT NULL,
  isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0, 1)),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS timeEntries (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  date TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  categoryId TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL CHECK (source IN ('manual', 'template', 'import')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY (categoryId) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS weekReviews (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  weekStartDate TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  wins TEXT NOT NULL DEFAULT '',
  problems TEXT NOT NULL DEFAULT '',
  nextWeekFocus TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  UNIQUE (userId, weekStartDate)
);

CREATE TABLE IF NOT EXISTS photoReferences (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  entryId TEXT,
  date TEXT NOT NULL,
  capturedAt TEXT NOT NULL,
  localAssetId TEXT NOT NULL,
  localUri TEXT,
  thumbnailLocalUri TEXT,
  thumbnailRemoteUrl TEXT,
  width INTEGER,
  height INTEGER,
  mediaType TEXT NOT NULL CHECK (mediaType IN ('photo', 'video')),
  matchType TEXT NOT NULL CHECK (matchType IN ('auto', 'manual')),
  isHidden INTEGER NOT NULL DEFAULT 0 CHECK (isHidden IN (0, 1)),
  permissionScope TEXT NOT NULL CHECK (permissionScope IN ('all', 'limited')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY (entryId) REFERENCES timeEntries(id)
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  weekStartsOn TEXT NOT NULL CHECK (weekStartsOn IN ('monday', 'sunday')),
  visibleStartTime TEXT NOT NULL,
  visibleEndTime TEXT NOT NULL,
  useFullDayView INTEGER NOT NULL DEFAULT 0 CHECK (useFullDayView IN (0, 1)),
  photoMatchingEnabled INTEGER NOT NULL DEFAULT 0 CHECK (photoMatchingEnabled IN (0, 1)),
  thumbnailSyncEnabled INTEGER NOT NULL DEFAULT 0 CHECK (thumbnailSyncEnabled IN (0, 1)),
  lastOpenedWeekStartDate TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE (userId)
);

CREATE TABLE IF NOT EXISTS syncState (
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'synced', 'failed')),
  retryCount INTEGER NOT NULL DEFAULT 0,
  lastError TEXT,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (entityType, entityId)
);
`;

export const CREATE_INITIAL_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_categories_user_sort
  ON categories (userId, sortOrder);

CREATE INDEX IF NOT EXISTS idx_categories_user_deleted
  ON categories (userId, deletedAt);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_date
  ON timeEntries (userId, date);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_category
  ON timeEntries (userId, categoryId);

CREATE INDEX IF NOT EXISTS idx_week_reviews_user_week
  ON weekReviews (userId, weekStartDate);

CREATE INDEX IF NOT EXISTS idx_photo_references_user_date
  ON photoReferences (userId, date);

CREATE INDEX IF NOT EXISTS idx_photo_references_entry
  ON photoReferences (entryId);

CREATE INDEX IF NOT EXISTS idx_sync_state_status_updated
  ON syncState (status, updatedAt);
`;
