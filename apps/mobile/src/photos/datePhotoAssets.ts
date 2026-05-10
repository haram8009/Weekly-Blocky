import {
  addDaysToDate,
  type DateString,
  type PhotoMediaType,
  type PhotoPermissionScope,
} from '@weekly/domain';

export type DatePhotoAsset = {
  id: string;
  localAssetId: string;
  capturedAt: string;
  localUri: string | null;
  width: number | null;
  height: number | null;
  mediaType: PhotoMediaType;
  permissionScope: PhotoPermissionScope;
};

export type DatePhotoLookupState = 'ready' | 'disabled' | 'permission-denied' | 'error';

export type DatePhotoLookupResult = {
  state: DatePhotoLookupState;
  assets: DatePhotoAsset[];
  permissionScope: PhotoPermissionScope | null;
  errorMessage: string | null;
};

export type MediaLibraryAssetLike = {
  id: string;
  uri?: string | null;
  mediaType: string;
  width?: number | null;
  height?: number | null;
  creationTime?: number | null;
};

export function createDatePhotoQueryRange(date: DateString): {
  createdAfter: Date;
  createdBefore: Date;
} {
  return {
    createdAfter: createLocalDateStart(date),
    createdBefore: createLocalDateStart(addDaysToDate(date, 1)),
  };
}

export function mapMediaLibraryAssetToDatePhotoAsset(
  asset: MediaLibraryAssetLike,
  permissionScope: PhotoPermissionScope,
): DatePhotoAsset | null {
  const creationTime = asset.creationTime;

  if (
    asset.mediaType !== 'photo' ||
    typeof creationTime !== 'number' ||
    !Number.isFinite(creationTime)
  ) {
    return null;
  }

  return {
    id: asset.id,
    localAssetId: asset.id,
    capturedAt: new Date(creationTime).toISOString(),
    localUri: asset.uri ?? null,
    width: typeof asset.width === 'number' ? asset.width : null,
    height: typeof asset.height === 'number' ? asset.height : null,
    mediaType: 'photo',
    permissionScope,
  };
}

function createLocalDateStart(date: DateString): Date {
  const [yearText, monthText, dayText] = date.split('-');

  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText), 0, 0, 0, 0);
}
