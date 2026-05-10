import type { PhotoReference } from '@weekly/domain';
import { describe, expect, it } from 'vitest';

import { createThumbnailUploadRequest } from './thumbnailSyncRequest';

function createPhotoReference(overrides: Partial<PhotoReference> = {}): PhotoReference {
  return {
    id: 'photo:user-1:asset-1',
    userId: 'user-1',
    entryId: 'entry-1',
    date: '2026-05-11',
    capturedAt: '2026-05-11T09:20:00',
    localAssetId: 'asset-1',
    localUri: 'file:///original/photo.jpg',
    thumbnailLocalUri: 'file:///thumbnail/photo.jpg',
    thumbnailRemoteUrl: null,
    width: 320,
    height: 240,
    mediaType: 'photo',
    matchType: 'auto',
    isHidden: false,
    permissionScope: 'all',
    createdAt: '2026-05-11T09:20:00.000Z',
    updatedAt: '2026-05-11T09:20:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('thumbnail sync', () => {
  it('creates upload requests from local thumbnails, not original local photo URIs', () => {
    const request = createThumbnailUploadRequest('user-1', createPhotoReference());

    expect(request).toEqual({
      photoReferenceId: 'photo:user-1:asset-1',
      thumbnailLocalUri: 'file:///thumbnail/photo.jpg',
      storagePath: 'user-1/photo%3Auser-1%3Aasset-1.jpg',
    });
  });

  it('skips photos without syncable local thumbnails', () => {
    expect(
      createThumbnailUploadRequest(
        'user-1',
        createPhotoReference({ thumbnailLocalUri: null, thumbnailRemoteUrl: null }),
      ),
    ).toBeNull();
    expect(
      createThumbnailUploadRequest(
        'user-1',
        createPhotoReference({ thumbnailRemoteUrl: 'user-1/photo.jpg' }),
      ),
    ).toBeNull();
    expect(
      createThumbnailUploadRequest('user-1', createPhotoReference({ isHidden: true })),
    ).toBeNull();
    expect(
      createThumbnailUploadRequest(
        'user-1',
        createPhotoReference({ deletedAt: '2026-05-11T09:30:00.000Z' }),
      ),
    ).toBeNull();
  });
});
