import type {
  DateString,
  EntryOverlapResolution,
  TimeEntry,
  TimeString,
  TimestampString,
  WeekReview,
} from '@weekly/domain';
import {
  formatDiaryMinutesToTime,
  parseDiaryTimeToMinutes,
  resolveEntryOverlaps,
  validateDiaryTimeRange,
} from '@weekly/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseStorageError } from './errors';
import { SupabaseTimeEntryRepository, SupabaseWeekReviewRepository } from './repositories';
import type {
  CreateTimeEntryInput,
  DeleteTimeEntryInput,
  UpdateTimeEntryInput,
  UpsertWeekReviewInput,
} from './types';

type MatchingEntryMerge = {
  entry: TimeEntry;
  nextRange: {
    id: string;
    date: DateString;
    startTime: TimeString;
    endTime: TimeString;
  };
};

export class SupabaseTimeEntryService {
  private readonly repository: SupabaseTimeEntryRepository;

  constructor(client: SupabaseClient) {
    this.repository = new SupabaseTimeEntryRepository(client);
  }

  async createTimeEntry(input: CreateTimeEntryInput): Promise<TimeEntry> {
    assertValidTimeRange(input.startTime, input.endTime);
    const now = input.now ?? new Date().toISOString();
    const existingEntries = await this.repository.listTimeEntriesByDate(input.date);
    const matchingEntryMerge = findMatchingEntryMerge(existingEntries, input);

    if (matchingEntryMerge) {
      const { entry, nextRange } = matchingEntryMerge;
      const overlapResolution = resolveEntryOverlaps(existingEntries, nextRange);

      await this.applyOverlapResolution(overlapResolution, now);

      return this.repository.updateTimeEntry({
        id: entry.id,
        startTime: nextRange.startTime,
        endTime: nextRange.endTime,
        now,
      });
    }

    const overlapResolution = resolveEntryOverlaps(existingEntries, input);

    await this.applyOverlapResolution(overlapResolution, now);

    return this.repository.insertTimeEntry({ ...input, now });
  }

  async updateTimeEntry(input: UpdateTimeEntryInput): Promise<TimeEntry> {
    const existingEntry = await this.repository.getTimeEntryById(input.id);

    if (!existingEntry) {
      throw new SupabaseStorageError(
        'NOT_FOUND',
        '수정할 기록을 찾지 못했습니다. 서버 데이터를 새로고침한 뒤 다시 시도해주세요.',
        `Time entry not found: ${input.id}`,
      );
    }

    const now = input.now ?? new Date().toISOString();
    const nextRange = {
      id: input.id,
      date: input.date ?? existingEntry.date,
      startTime: input.startTime ?? existingEntry.startTime,
      endTime: input.endTime ?? existingEntry.endTime,
    };

    assertValidTimeRange(nextRange.startTime, nextRange.endTime);

    const existingEntries = await this.repository.listTimeEntriesByDate(nextRange.date);
    const overlapResolution = resolveEntryOverlaps(existingEntries, nextRange);

    await this.applyOverlapResolution(overlapResolution, now);

    return this.repository.updateTimeEntry({
      ...input,
      date: nextRange.date,
      startTime: nextRange.startTime,
      endTime: nextRange.endTime,
      now,
    });
  }

  async deleteTimeEntry(input: DeleteTimeEntryInput): Promise<TimeEntry> {
    return this.repository.softDeleteTimeEntry(input.id, input.now);
  }

  async listTimeEntriesByDate(date: DateString): Promise<TimeEntry[]> {
    return this.repository.listTimeEntriesByDate(date);
  }

  async listTimeEntriesByWeek(weekStartDate: DateString): Promise<TimeEntry[]> {
    return this.repository.listTimeEntriesByWeek(weekStartDate);
  }

  private async applyOverlapResolution(
    resolution: EntryOverlapResolution<TimeEntry>,
    now: TimestampString,
  ): Promise<void> {
    for (const split of resolution.splits) {
      await this.repository.updateTimeEntry({
        id: split.entry.id,
        startTime: split.before.startTime,
        endTime: split.before.endTime,
        now,
      });
      await this.repository.insertTimeEntry({
        date: split.entry.date,
        startTime: split.after.startTime,
        endTime: split.after.endTime,
        categoryId: split.entry.categoryId,
        note: split.entry.note,
        source: split.entry.source,
        now,
      });
    }

    for (const update of resolution.updates) {
      await this.repository.updateTimeEntry({
        id: update.entry.id,
        startTime: update.patch.startTime,
        endTime: update.patch.endTime,
        now,
      });
    }

    for (const entry of resolution.deletes) {
      await this.repository.softDeleteTimeEntry(entry.id, now);
    }
  }
}

export function createTimeEntry(
  client: SupabaseClient,
  input: CreateTimeEntryInput,
): Promise<TimeEntry> {
  return new SupabaseTimeEntryService(client).createTimeEntry(input);
}

export function updateTimeEntry(
  client: SupabaseClient,
  input: UpdateTimeEntryInput,
): Promise<TimeEntry> {
  return new SupabaseTimeEntryService(client).updateTimeEntry(input);
}

export function deleteTimeEntry(
  client: SupabaseClient,
  input: DeleteTimeEntryInput,
): Promise<TimeEntry> {
  return new SupabaseTimeEntryService(client).deleteTimeEntry(input);
}

export function listTimeEntriesByDate(
  client: SupabaseClient,
  date: DateString,
): Promise<TimeEntry[]> {
  return new SupabaseTimeEntryService(client).listTimeEntriesByDate(date);
}

export function listTimeEntriesByWeek(
  client: SupabaseClient,
  weekStartDate: DateString,
): Promise<TimeEntry[]> {
  return new SupabaseTimeEntryService(client).listTimeEntriesByWeek(weekStartDate);
}

export type WeekReviewReloadRepository = {
  upsertWeekReview(input: UpsertWeekReviewInput): Promise<WeekReview>;
  getWeekReviewByWeekStartDate(weekStartDate: DateString): Promise<WeekReview | null>;
};

export async function upsertAndReloadWeekReviewWithRepository(
  repository: WeekReviewReloadRepository,
  input: UpsertWeekReviewInput,
): Promise<WeekReview> {
  await repository.upsertWeekReview(input);

  const reloadedReview = await repository.getWeekReviewByWeekStartDate(input.weekStartDate);

  if (!reloadedReview) {
    throw new SupabaseStorageError(
      'QUERY_FAILED',
      '회고를 저장했지만 서버에서 다시 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
      `Week review reload returned no row: ${input.weekStartDate}`,
    );
  }

  return reloadedReview;
}

export function upsertAndReloadWeekReview(
  client: SupabaseClient,
  input: UpsertWeekReviewInput,
): Promise<WeekReview> {
  return upsertAndReloadWeekReviewWithRepository(new SupabaseWeekReviewRepository(client), input);
}

function assertValidTimeRange(startTime: string, endTime: string): void {
  const result = validateDiaryTimeRange(startTime, endTime);

  if (!result.isValid) {
    throw new SupabaseStorageError(
      'VALIDATION_FAILED',
      '시간은 10분 단위이며 종료 시간이 시작 시간보다 늦어야 합니다.',
      `Invalid time range: ${startTime}-${endTime} (${result.errors.join(', ')})`,
    );
  }
}

function findMatchingEntryMerge(
  existingEntries: readonly TimeEntry[],
  input: CreateTimeEntryInput,
): MatchingEntryMerge | null {
  const inputNote = input.note ?? '';
  const inputSource = input.source ?? 'manual';
  const inputStartMinutes = parseDiaryTimeToMinutes(input.startTime);
  const inputEndMinutes = parseDiaryTimeToMinutes(input.endTime);
  const candidates = existingEntries.filter(
    (entry) =>
      entry.deletedAt === null &&
      entry.date === input.date &&
      entry.categoryId === input.categoryId &&
      entry.note === inputNote &&
      entry.source === inputSource &&
      parseDiaryTimeToMinutes(entry.startTime) <= inputEndMinutes &&
      parseDiaryTimeToMinutes(entry.endTime) >= inputStartMinutes,
  );

  if (candidates.length === 0) {
    return null;
  }

  const sortedCandidates = [...candidates].sort((first, second) =>
    first.startTime.localeCompare(second.startTime),
  );
  const startMinutes = Math.min(
    inputStartMinutes,
    ...sortedCandidates.map((entry) => parseDiaryTimeToMinutes(entry.startTime)),
  );
  const endMinutes = Math.max(
    inputEndMinutes,
    ...sortedCandidates.map((entry) => parseDiaryTimeToMinutes(entry.endTime)),
  );
  const entry = sortedCandidates[0];

  if (!entry) {
    return null;
  }

  return {
    entry,
    nextRange: {
      id: entry.id,
      date: input.date,
      startTime: formatDiaryMinutesToTime(startMinutes),
      endTime: formatDiaryMinutesToTime(endMinutes),
    },
  };
}
