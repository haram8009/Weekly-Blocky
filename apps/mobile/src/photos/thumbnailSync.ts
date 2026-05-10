import { uploadThumbnail, upsertPhotoReference } from '@weekly/data';
import type { EntityId, PhotoReference } from '@weekly/domain';

import { getSupabaseClient } from '../lib/supabase/client';
import { createThumbnailUploadRequest } from './thumbnailSyncRequest';

export type RemoteThumbnailSyncResult = {
  photoId: EntityId;
  thumbnailRemoteUrl: string;
};

export type SyncRemoteThumbnailsInput = {
  userId: EntityId;
  references: readonly PhotoReference[];
  now?: string;
};

export async function syncRemoteThumbnails({
  userId,
  references,
  now = new Date().toISOString(),
}: SyncRemoteThumbnailsInput): Promise<RemoteThumbnailSyncResult[]> {
  const client = getSupabaseClient();
  const results: RemoteThumbnailSyncResult[] = [];

  for (const reference of references) {
    const request = createThumbnailUploadRequest(userId, reference);

    if (!request) {
      continue;
    }

    const body = await readBlobFromUri(request.thumbnailLocalUri);
    const thumbnailRemoteUrl = await uploadThumbnail(client, {
      photoReferenceId: request.photoReferenceId,
      body,
      contentType: 'image/jpeg',
    });

    await upsertPhotoReference(client, {
      id: reference.id,
      entryId: reference.entryId,
      date: reference.date,
      capturedAt: reference.capturedAt,
      localAssetId: reference.localAssetId,
      thumbnailRemoteUrl,
      width: reference.width,
      height: reference.height,
      mediaType: reference.mediaType,
      matchType: reference.matchType,
      isHidden: reference.isHidden,
      permissionScope: reference.permissionScope,
      now,
    });

    results.push({ photoId: reference.id, thumbnailRemoteUrl });
  }

  return results;
}

async function readBlobFromUri(uri: string): Promise<Blob> {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error('로컬 썸네일 파일을 읽지 못했습니다.');
  }

  return response.blob();
}
