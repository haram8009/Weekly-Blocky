import * as MediaLibrary from 'expo-media-library';
import type { DateString, PhotoPermissionScope } from '@weekly/domain';

import {
  createDatePhotoQueryRange,
  mapMediaLibraryAssetToDatePhotoAsset,
  type DatePhotoAsset,
  type DatePhotoLookupResult,
} from './datePhotoAssets';

const DATE_PHOTO_PAGE_SIZE = 100;
const MAX_DATE_PHOTO_ASSETS = 500;

export async function listDatePhotoAssets(date: DateString): Promise<DatePhotoLookupResult> {
  const permission = await MediaLibrary.getPermissionsAsync();
  const permissionStatus = String(permission.status);

  if (permissionStatus !== 'granted') {
    return {
      state: 'permission-denied',
      assets: [],
      permissionScope: null,
      errorMessage: null,
    };
  }

  const permissionScope = getPermissionScope(permission);
  const { createdAfter, createdBefore } = createDatePhotoQueryRange(date);
  const assets: DatePhotoAsset[] = [];
  let after: string | undefined;
  let hasNextPage = true;

  while (hasNextPage && assets.length < MAX_DATE_PHOTO_ASSETS) {
    const page = await MediaLibrary.getAssetsAsync({
      after,
      createdAfter,
      createdBefore,
      first: DATE_PHOTO_PAGE_SIZE,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [MediaLibrary.SortBy.creationTime, true],
    });

    for (const asset of page.assets) {
      const datePhotoAsset = mapMediaLibraryAssetToDatePhotoAsset(asset, permissionScope);

      if (datePhotoAsset) {
        assets.push(datePhotoAsset);
      }
    }

    after = page.endCursor;
    hasNextPage = page.hasNextPage;
  }

  return {
    state: 'ready',
    assets,
    permissionScope,
    errorMessage: null,
  };
}

function getPermissionScope(
  permission: Awaited<ReturnType<typeof MediaLibrary.getPermissionsAsync>>,
): PhotoPermissionScope {
  if ('accessPrivileges' in permission && permission.accessPrivileges === 'limited') {
    return 'limited';
  }

  return 'all';
}
