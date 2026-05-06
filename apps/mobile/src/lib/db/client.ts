import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { LOCAL_DATABASE_NAME } from './schema';

let localDatabasePromise: Promise<SQLiteDatabase> | null = null;

export function getLocalDatabase(): Promise<SQLiteDatabase> {
  localDatabasePromise ??= openDatabaseAsync(LOCAL_DATABASE_NAME);

  return localDatabasePromise;
}

export async function configureLocalDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync(`
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
`);
}

export async function closeLocalDatabase(): Promise<void> {
  if (!localDatabasePromise) {
    return;
  }

  const database = await localDatabasePromise;
  await database.closeAsync();
  localDatabasePromise = null;
}
