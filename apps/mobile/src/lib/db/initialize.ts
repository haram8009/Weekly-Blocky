import type { SQLiteDatabase } from 'expo-sqlite';

import { getLocalDatabase } from './client';
import { getLocalSchemaVersion, runLocalDatabaseMigrations } from './migrations';
import { CURRENT_SCHEMA_VERSION, LOCAL_TABLE_NAMES, type LocalTableName } from './schema';

export type LocalDatabaseInitializationState = {
  schemaVersion: number;
  isInitialized: boolean;
  missingTables: LocalTableName[];
};

async function getMissingTables(database: SQLiteDatabase): Promise<LocalTableName[]> {
  const missingTables: LocalTableName[] = [];

  for (const tableName of LOCAL_TABLE_NAMES) {
    const row = await database.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      tableName,
    );

    if (row === null) {
      missingTables.push(tableName);
    }
  }

  return missingTables;
}

export async function getLocalDatabaseInitializationState(
  database?: SQLiteDatabase,
): Promise<LocalDatabaseInitializationState> {
  const localDatabase = database ?? (await getLocalDatabase());
  const [schemaVersion, missingTables] = await Promise.all([
    getLocalSchemaVersion(localDatabase),
    getMissingTables(localDatabase),
  ]);

  return {
    schemaVersion,
    missingTables,
    isInitialized: schemaVersion >= CURRENT_SCHEMA_VERSION && missingTables.length === 0,
  };
}

export async function isLocalDatabaseInitialized(database?: SQLiteDatabase): Promise<boolean> {
  const state = await getLocalDatabaseInitializationState(database);

  return state.isInitialized;
}

export async function initializeLocalDatabase(
  database?: SQLiteDatabase,
): Promise<LocalDatabaseInitializationState> {
  const localDatabase = database ?? (await getLocalDatabase());

  await runLocalDatabaseMigrations(localDatabase);

  return getLocalDatabaseInitializationState(localDatabase);
}
