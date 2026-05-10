import { createThumbnailStoragePath } from '@weekly/data';
import type { EntityId, PhotoReference } from '@weekly/domain';

export type ThumbnailUploadRequest = {
  photoReferenceId: EntityId;
  thumbnailLocalUri: string;
  storagePath: string;
};

export function createThumbnailUploadRequest(
  userId: EntityId,
  reference: PhotoReference,
): ThumbnailUploadRequest | null {
  if (
    !reference.thumbnailLocalUri ||
    reference.thumbnailRemoteUrl ||
    reference.isHidden ||
    reference.deletedAt
  ) {
    return null;
  }

  return {
    photoReferenceId: reference.id,
    thumbnailLocalUri: reference.thumbnailLocalUri,
    storagePath: createThumbnailStoragePath(userId, reference.id),
  };
}
