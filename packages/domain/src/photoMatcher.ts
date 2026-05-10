import type { EntityId, PhotoMatchType, TimestampString } from './index';
import { isCapturedWithinEntry } from './time';

export type PhotoMatcherEntry = {
  id: EntityId;
  date: string;
  startTime: string;
  endTime: string;
  deletedAt: TimestampString | null;
};

export type PhotoMatcherPhoto = {
  id: EntityId;
  date: string;
  capturedAt: TimestampString;
  entryId: EntityId | null;
  matchType: PhotoMatchType;
  isHidden: boolean;
  deletedAt: TimestampString | null;
};

export type PhotoMatchUpdate = {
  photoId: EntityId;
  entryId: EntityId | null;
  matchType: PhotoMatchType;
};

export type PhotoMatchGroup = {
  entryId: EntityId;
  photoIds: EntityId[];
};

export type PhotoMatchResult = {
  updates: PhotoMatchUpdate[];
  matches: PhotoMatchGroup[];
};

export function resolvePhotoMatches(
  entries: readonly PhotoMatcherEntry[],
  photos: readonly PhotoMatcherPhoto[],
): PhotoMatchResult {
  const activeEntries = entries.filter((entry) => !entry.deletedAt);
  const activeEntryIds = new Set(activeEntries.map((entry) => entry.id));
  const photoIdsByEntryId = new Map<EntityId, EntityId[]>();
  const updates: PhotoMatchUpdate[] = [];

  for (const photo of photos) {
    if (photo.deletedAt || photo.isHidden) {
      continue;
    }

    if (photo.entryId && !activeEntryIds.has(photo.entryId)) {
      updates.push({
        photoId: photo.id,
        entryId: null,
        matchType: photo.matchType,
      });
      continue;
    }

    if (photo.matchType === 'manual') {
      if (photo.entryId) {
        addPhotoMatch(photoIdsByEntryId, photo.entryId, photo.id);
      }

      updates.push({
        photoId: photo.id,
        entryId: photo.entryId,
        matchType: 'manual',
      });
      continue;
    }

    const matchedEntry = activeEntries.find(
      (entry) => entry.date === photo.date && isCapturedWithinEntry(photo.capturedAt, entry),
    );

    if (matchedEntry) {
      addPhotoMatch(photoIdsByEntryId, matchedEntry.id, photo.id);
    }

    updates.push({
      photoId: photo.id,
      entryId: matchedEntry?.id ?? null,
      matchType: 'auto',
    });
  }

  return {
    updates,
    matches: activeEntries
      .map((entry) => ({
        entryId: entry.id,
        photoIds: photoIdsByEntryId.get(entry.id) ?? [],
      }))
      .filter((match) => match.photoIds.length > 0),
  };
}

function addPhotoMatch(
  photoIdsByEntryId: Map<EntityId, EntityId[]>,
  entryId: EntityId,
  photoId: EntityId,
) {
  const photoIds = photoIdsByEntryId.get(entryId) ?? [];

  photoIds.push(photoId);
  photoIdsByEntryId.set(entryId, photoIds);
}
