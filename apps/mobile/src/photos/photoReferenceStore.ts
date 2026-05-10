import {
  resolvePhotoMatches,
  type EntityId,
  type PhotoReference,
  type TimeEntry,
} from '@weekly/domain';

import { getLocalDatabase } from '@/lib/db/client';
import { initializeLocalDatabase } from '@/lib/db/initialize';
import type { DatePhotoAsset } from './datePhotoAssets';
import { createLocalPhotoThumbnail } from './thumbnails';

const MAX_THUMBNAIL_CANDIDATES_PER_ENTRY = 3;

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

export type UpdatePhotoReferenceVisibilityInput = {
  userId: EntityId;
  date: string;
  photoId: EntityId;
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
  thumbnailLocalUri = CASE
    WHEN photoReferences.localUri = excluded.localUri
      OR (photoReferences.localUri IS NULL AND excluded.localUri IS NULL)
    THEN photoReferences.thumbnailLocalUri
    ELSE NULL
  END,
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

  const nextReferences = await listPhotoReferencesByDate(userId, date);

  await ensureLocalThumbnails(userId, nextReferences, now);

  return listPhotoReferencesByDate(userId, date);
}

export async function hidePhotoReference({
  userId,
  date,
  photoId,
  now = new Date().toISOString(),
}: UpdatePhotoReferenceVisibilityInput): Promise<PhotoReference[]> {
  const database = await getLocalDatabase();

  await initializeLocalDatabase(database);
  await database.runAsync(
    `
UPDATE photoReferences
SET entryId = NULL, matchType = 'manual', isHidden = 1, updatedAt = ?
WHERE id = ? AND userId = ?
`,
    now,
    photoId,
    userId,
  );

  return listPhotoReferencesByDate(userId, date);
}

export async function unlinkPhotoReference({
  userId,
  date,
  photoId,
  now = new Date().toISOString(),
}: UpdatePhotoReferenceVisibilityInput): Promise<PhotoReference[]> {
  const database = await getLocalDatabase();

  await initializeLocalDatabase(database);
  await database.runAsync(
    `
UPDATE photoReferences
SET entryId = NULL, matchType = 'manual', updatedAt = ?
WHERE id = ? AND userId = ?
`,
    now,
    photoId,
    userId,
  );

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

async function ensureLocalThumbnails(
  userId: EntityId,
  references: readonly PhotoReference[],
  updatedAt: string,
): Promise<void> {
  const database = await getLocalDatabase();
  const candidateReferences = selectThumbnailCandidateReferences(references);

  for (const reference of candidateReferences) {
    if (!reference.localUri) {
      continue;
    }

    try {
      const thumbnail = await createLocalPhotoThumbnail(reference.localUri);

      await database.runAsync(
        `
UPDATE photoReferences
SET thumbnailLocalUri = ?, updatedAt = ?
WHERE id = ? AND userId = ?
`,
        thumbnail.uri,
        updatedAt,
        reference.id,
        userId,
      );
    } catch {
      // Thumbnail generation is best-effort; photo references remain useful without it.
    }
  }
}

function selectThumbnailCandidateReferences(
  references: readonly PhotoReference[],
): PhotoReference[] {
  const countByEntryId = new Map<EntityId, number>();
  const candidates: PhotoReference[] = [];

  for (const reference of references) {
    if (
      !reference.entryId ||
      reference.isHidden ||
      reference.deletedAt ||
      reference.thumbnailLocalUri ||
      !reference.localUri
    ) {
      continue;
    }

    const currentCount = countByEntryId.get(reference.entryId) ?? 0;

    if (currentCount >= MAX_THUMBNAIL_CANDIDATES_PER_ENTRY) {
      continue;
    }

    candidates.push(reference);
    countByEntryId.set(reference.entryId, currentCount + 1);
  }

  return candidates;
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
