import {
  createSupabaseQueryError,
  createThumbnailSignedUrl,
  listPhotoReferencesByWeek,
  requireCurrentUserId,
} from '@weekly/data';
import type { DateString } from '@weekly/domain';

import { getSupabaseClient } from './client';

const READ_ERROR_MESSAGE = '서버 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

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

export async function listWebPhotoReferenceCountsByEntryIds(
  entryIds: readonly string[],
): Promise<Map<string, number>> {
  const uniqueEntryIds = [...new Set(entryIds)];

  if (uniqueEntryIds.length === 0) {
    return new Map();
  }

  const client = getSupabaseClient();
  const userId = await requireCurrentUserId(client);
  const { data, error } = await client
    .from('photo_references')
    .select('entry_id')
    .eq('user_id', userId)
    .in('entry_id', uniqueEntryIds)
    .eq('is_hidden', false)
    .is('deleted_at', null);

  if (error) {
    throw createSupabaseQueryError(READ_ERROR_MESSAGE, error);
  }

  const countsByEntryId = new Map<string, number>();

  for (const row of (data ?? []) as { entry_id: string | null }[]) {
    if (!row.entry_id) {
      continue;
    }

    countsByEntryId.set(row.entry_id, (countsByEntryId.get(row.entry_id) ?? 0) + 1);
  }

  return countsByEntryId;
}
