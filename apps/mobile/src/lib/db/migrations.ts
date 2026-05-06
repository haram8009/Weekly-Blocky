import type { SQLiteDatabase } from 'expo-sqlite';

import { configureLocalDatabase } from './client';
import {
  CREATE_INITIAL_INDEXES_SQL,
  CREATE_INITIAL_SCHEMA_SQL,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
} from './schema';

type SchemaVersionRow = {
  value: string;
};

type Migration = {
  fromVersion: number;
  toVersion: number;
  run: (database: SQLiteDatabase) => Promise<void>;
};

export type LocalDatabaseMigrationResult = {
  previousVersion: number;
  currentVersion: number;
  didMigrate: boolean;
};

const localMigrations: Migration[] = [
  {
    fromVersion: 0,
    toVersion: 1,
    run: async (database) => {
      await database.execAsync(CREATE_INITIAL_SCHEMA_SQL);
      await database.execAsync(CREATE_INITIAL_INDEXES_SQL);
      await setLocalSchemaVersion(database, 1);
    },
  },
];

async function hasMetadataTable(database: SQLiteDatabase): Promise<boolean> {
  const row = await database.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'localMetadata'",
  );

  return row !== null;
}

export async function getLocalSchemaVersion(database: SQLiteDatabase): Promise<number> {
  if (!(await hasMetadataTable(database))) {
    return 0;
  }

  const row = await database.getFirstAsync<SchemaVersionRow>(
    'SELECT value FROM localMetadata WHERE key = ?',
    SCHEMA_VERSION_KEY,
  );

  const version = Number(row?.value ?? 0);

  return Number.isInteger(version) && version >= 0 ? version : 0;
}

export async function setLocalSchemaVersion(
  database: SQLiteDatabase,
  version: number,
): Promise<void> {
  await database.runAsync(
    `
INSERT INTO localMetadata (key, value, updatedAt)
VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updatedAt = excluded.updatedAt
`,
    SCHEMA_VERSION_KEY,
    String(version),
    new Date().toISOString(),
  );
}

export async function runLocalDatabaseMigrations(
  database: SQLiteDatabase,
): Promise<LocalDatabaseMigrationResult> {
  await configureLocalDatabase(database);

  const previousVersion = await getLocalSchemaVersion(database);

  if (previousVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Local database schema version ${previousVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}.`,
    );
  }

  let currentVersion = previousVersion;

  for (const migration of localMigrations) {
    if (currentVersion !== migration.fromVersion) {
      continue;
    }

    await database.withTransactionAsync(async () => {
      await migration.run(database);
    });

    currentVersion = await getLocalSchemaVersion(database);

    if (currentVersion !== migration.toVersion) {
      throw new Error(
        `Local database migration failed. Expected version ${migration.toVersion}, got ${currentVersion}.`,
      );
    }
  }

  if (currentVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `No local database migration path from version ${currentVersion} to ${CURRENT_SCHEMA_VERSION}.`,
    );
  }

  return {
    previousVersion,
    currentVersion,
    didMigrate: previousVersion !== currentVersion,
  };
}
