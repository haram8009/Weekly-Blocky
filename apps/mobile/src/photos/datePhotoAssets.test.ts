import { describe, expect, it } from 'vitest';

import { createDatePhotoQueryRange, mapMediaLibraryAssetToDatePhotoAsset } from './datePhotoAssets';

describe('date photo assets', () => {
  it('creates a two-day local query range for next-day dawn matching', () => {
    const range = createDatePhotoQueryRange('2026-05-11');

    expect(range.createdAfter.getFullYear()).toBe(2026);
    expect(range.createdAfter.getMonth()).toBe(4);
    expect(range.createdAfter.getDate()).toBe(11);
    expect(range.createdAfter.getHours()).toBe(0);
    expect(range.createdBefore.getFullYear()).toBe(2026);
    expect(range.createdBefore.getMonth()).toBe(4);
    expect(range.createdBefore.getDate()).toBe(13);
    expect(range.createdBefore.getHours()).toBe(0);
  });

  it('maps only photo assets with a captured time', () => {
    expect(
      mapMediaLibraryAssetToDatePhotoAsset(
        {
          id: 'asset-1',
          uri: 'ph://asset-1',
          mediaType: 'photo',
          width: 1200,
          height: 800,
          creationTime: new Date(2026, 4, 11, 3, 20, 0).getTime(),
        },
        'limited',
      ),
    ).toEqual({
      id: 'asset-1',
      localAssetId: 'asset-1',
      capturedAt: '2026-05-11T03:20:00',
      localUri: 'ph://asset-1',
      width: 1200,
      height: 800,
      mediaType: 'photo',
      permissionScope: 'limited',
    });

    expect(
      mapMediaLibraryAssetToDatePhotoAsset(
        {
          id: 'video-1',
          mediaType: 'video',
          creationTime: new Date(2026, 4, 11, 3, 20, 0).getTime(),
        },
        'all',
      ),
    ).toBeNull();
  });
});
