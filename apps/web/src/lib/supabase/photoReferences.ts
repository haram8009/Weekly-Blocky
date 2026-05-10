import { createThumbnailSignedUrl, listPhotoReferencesByWeek } from '@weekly/data';
import type { DateString } from '@weekly/domain';

import { getSupabaseClient } from './client';

export async function listWebPhotoReferencesByWeek(weekStartDate: DateString) {
  const client = getSupabaseClient();
  const references = await listPhotoReferencesByWeek(client, weekStartDate);

  return Promise.all(
    references.map(async (reference) => ({
      ...reference,
      thumbnailRemoteUrl: reference.thumbnailRemoteUrl
        ? await createThumbnailSignedUrl(client, reference.thumbnailRemoteUrl)
        : null,
    })),
  );
}
