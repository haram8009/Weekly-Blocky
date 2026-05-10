import {
  resolvePhotoMatches,
  type EntityId,
  type PhotoReference,
  type TimeEntry,
} from '@weekly/domain';

import { getLocalDatabase } from '@/lib/db/client';
import { initializeLocalDatabase } from '@/lib/db/initialize';
import type { DatePhotoAsset } from './datePhotoAssets';

type PhotoReferenceRow = {
  id: string;
  userId: string;
  entryId: string | null;
  date: string;
  capturedAt: string;
  localAssetId: string;
  localUri: string | null;
  thumbnailLocalUri: string | null;
  thumbnailRemoteUrl: string | null;
  width: number | null;
  height: number | null;
  mediaType: PhotoReference['mediaType'];
  matchType: PhotoReference['matchType'];
  isHidden: number;
  permissionScope: PhotoReference['permissionScope'];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type SyncDatePhotoReferencesInput = {
  userId: EntityId;
  date: string;
  assets: readonly DatePhotoAsset[];
  entries: readonly TimeEntry[];
  now?: string;
};

export async function syncDatePhotoReferences({
  userId,
  date,
  assets,
  entries,
  now = new Date().toISOString(),
}: SyncDatePhotoReferencesInput): Promise<PhotoReference[]> {
  const database = await getLocalDatabase();

  await initializeLocalDatabase(database);
  await database.withTransactionAsync(async () => {
    for (const asset of assets) {
      await database.runAsync(
        `
INSERT INTO photoReferences (
  id,
  userId,
  entryId,
  date,
  capturedAt,
  localAssetId,
  localUri,
  thumbnailLocalUri,
  thumbnailRemoteUrl,
  width,
  height,
  mediaType,
  matchType,
  isHidden,
  permissionScope,
  createdAt,
  updatedAt,
  deletedAt
)
VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'auto', 0, ?, ?, ?, NULL)
ON CONFLICT(id) DO UPDATE SET
  date = excluded.date,
  capturedAt = excluded.capturedAt,
  localAssetId = excluded.localAssetId,
  localUri = excluded.localUri,
  width = excluded.width,
  height = excluded.height,
  mediaType = excluded.mediaType,
  permissionScope = excluded.permissionScope,
  updatedAt = excluded.updatedAt,
  deletedAt = NULL
`,
        createPhotoReferenceId(userId, asset.localAssetId),
        userId,
        date,
        asset.capturedAt,
        asset.localAssetId,
        asset.localUri,
        asset.width,
        asset.height,
        asset.mediaType,
        asset.permissionScope,
        now,
        now,
      );
    }
  });

  const references = await listPhotoReferencesByDate(userId, date);
  const matchResult = resolvePhotoMatches(entries, references);

  await database.withTransactionAsync(async () => {
    for (const update of matchResult.updates) {
      await database.runAsync(
        `
UPDATE photoReferences
SET entryId = ?, matchType = ?, updatedAt = ?
WHERE id = ? AND userId = ?
`,
        update.entryId,
        update.matchType,
        now,
        update.photoId,
        userId,
      );
    }
  });

  return listPhotoReferencesByDate(userId, date);
}

export async function listPhotoReferencesByDate(
  userId: EntityId,
  date: string,
): Promise<PhotoReference[]> {
  const database = await getLocalDatabase();

  await initializeLocalDatabase(database);

  const rows = await database.getAllAsync<PhotoReferenceRow>(
    `
SELECT *
FROM photoReferences
WHERE userId = ? AND date = ? AND deletedAt IS NULL
ORDER BY capturedAt ASC, id ASC
`,
    userId,
    date,
  );

  return rows.map(mapPhotoReferenceRow);
}

function createPhotoReferenceId(userId: EntityId, localAssetId: string): EntityId {
  return `photo:${userId}:${localAssetId}`;
}

function mapPhotoReferenceRow(row: PhotoReferenceRow): PhotoReference {
  return {
    id: row.id,
    userId: row.userId,
    entryId: row.entryId,
    date: row.date,
    capturedAt: row.capturedAt,
    localAssetId: row.localAssetId,
    localUri: row.localUri,
    thumbnailLocalUri: row.thumbnailLocalUri,
    thumbnailRemoteUrl: row.thumbnailRemoteUrl,
    width: row.width,
    height: row.height,
    mediaType: row.mediaType,
    matchType: row.matchType,
    isHidden: row.isHidden === 1,
    permissionScope: row.permissionScope,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}
