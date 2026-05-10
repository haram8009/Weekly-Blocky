import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type LocalPhotoThumbnail = {
  uri: string;
  width: number;
  height: number;
};

const DEFAULT_THUMBNAIL_WIDTH = 320;
const DEFAULT_THUMBNAIL_COMPRESSION = 0.72;

export async function createLocalPhotoThumbnail(sourceUri: string): Promise<LocalPhotoThumbnail> {
  const result = await manipulateAsync(
    sourceUri,
    [{ resize: { width: DEFAULT_THUMBNAIL_WIDTH } }],
    {
      compress: DEFAULT_THUMBNAIL_COMPRESSION,
      format: SaveFormat.JPEG,
    },
  );

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}
