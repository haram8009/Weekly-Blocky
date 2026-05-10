import { beforeEach, describe, expect, it, vi } from 'vitest';

const mediaLibraryMock = vi.hoisted(() => ({
  getAssetsAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
}));

vi.mock('expo-media-library', () => ({
  MediaType: {
    photo: 'photo',
  },
  SortBy: {
    creationTime: 'creationTime',
  },
  getAssetsAsync: mediaLibraryMock.getAssetsAsync,
  getPermissionsAsync: mediaLibraryMock.getPermissionsAsync,
}));

import { listDatePhotoAssets } from './mediaLibrary';

describe('listDatePhotoAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes creationTime sort as one sortBy tuple', async () => {
    mediaLibraryMock.getPermissionsAsync.mockResolvedValue({
      accessPrivileges: 'all',
      status: 'granted',
    });
    mediaLibraryMock.getAssetsAsync.mockResolvedValue({
      assets: [],
      endCursor: undefined,
      hasNextPage: false,
    });

    await listDatePhotoAssets('2026-05-11');

    expect(mediaLibraryMock.getAssetsAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: 'photo',
        sortBy: [['creationTime', true]],
      }),
    );
  });
});
