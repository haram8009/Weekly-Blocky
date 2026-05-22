import type { TimeEntry, WeekReview } from '@weekly/domain';
import { describe, expect, it } from 'vitest';

import { SupabaseStorageError } from './errors';
import { SupabaseTimeEntryService, upsertAndReloadWeekReviewWithRepository } from './services';
import type {
  CreateTimeEntryRepositoryInput,
  UpdateTimeEntryRepositoryInput,
  UpsertWeekReviewInput,
} from './types';

const input: UpsertWeekReviewInput = {
  weekStartDate: '2026-05-18',
  summary: '이번 주 요약',
  wins: '잘한 점',
  problems: '아쉬운 점',
  nextWeekFocus: '다음 주 집중',
  now: '2026-05-21T09:00:00.000Z',
};

const reloadedReview: WeekReview = {
  id: 'weekReview:user-1:2026-05-18',
  userId: 'user-1',
  weekStartDate: '2026-05-18',
  summary: input.summary ?? '',
  wins: input.wins ?? '',
  problems: input.problems ?? '',
  nextWeekFocus: input.nextWeekFocus ?? '',
  createdAt: '2026-05-21T08:00:00.000Z',
  updatedAt: '2026-05-21T09:00:01.000Z',
  deletedAt: null,
};

const baseTimeEntry: TimeEntry = {
  id: 'timeEntry:1',
  userId: 'user-1',
  date: '2026-05-21',
  startTime: '14:00',
  endTime: '14:20',
  categoryId: 'category:study',
  note: '',
  source: 'manual',
  createdAt: '2026-05-21T05:00:00.000Z',
  updatedAt: '2026-05-21T05:00:00.000Z',
  deletedAt: null,
};

type TimeEntryRepositoryStub = {
  listTimeEntriesByDate(date: string): Promise<TimeEntry[]>;
  insertTimeEntry(input: CreateTimeEntryRepositoryInput): Promise<TimeEntry>;
  updateTimeEntry(input: UpdateTimeEntryRepositoryInput): Promise<TimeEntry>;
  softDeleteTimeEntry(id: string, now?: string): Promise<TimeEntry>;
};

function createTimeEntryService(repository: TimeEntryRepositoryStub): SupabaseTimeEntryService {
  const service = new SupabaseTimeEntryService({} as never);
  (service as unknown as { repository: TimeEntryRepositoryStub }).repository = repository;

  return service;
}

describe('SupabaseTimeEntryService.createTimeEntry', () => {
  it('extends the immediately previous matching entry instead of inserting a duplicate block', async () => {
    const calls: string[] = [];
    const updatedEntry = {
      ...baseTimeEntry,
      endTime: '14:50',
      updatedAt: '2026-05-21T05:20:00.000Z',
    };

    const result = await createTimeEntryService({
      async listTimeEntriesByDate(date) {
        calls.push(`list:${date}`);
        return [baseTimeEntry];
      },
      async insertTimeEntry() {
        calls.push('insert');
        throw new Error('insert should not be called');
      },
      async updateTimeEntry(input) {
        calls.push(`update:${input.id}:${input.startTime}-${input.endTime}`);
        expect(input).toMatchObject({
          id: baseTimeEntry.id,
          startTime: '14:00',
          endTime: '14:50',
          now: '2026-05-21T05:20:00.000Z',
        });
        return updatedEntry;
      },
      async softDeleteTimeEntry() {
        throw new Error('soft delete should not be called');
      },
    }).createTimeEntry({
      date: '2026-05-21',
      startTime: '14:20',
      endTime: '14:50',
      categoryId: 'category:study',
      now: '2026-05-21T05:20:00.000Z',
    });

    expect(calls).toEqual(['list:2026-05-21', 'update:timeEntry:1:14:00-14:50']);
    expect(result).toBe(updatedEntry);
  });

  it('keeps adjacent entries separate when the note differs', async () => {
    const calls: string[] = [];
    const insertedEntry = {
      ...baseTimeEntry,
      id: 'timeEntry:2',
      startTime: '14:20',
      endTime: '14:50',
      note: '다른 메모',
    };

    const result = await createTimeEntryService({
      async listTimeEntriesByDate(date) {
        calls.push(`list:${date}`);
        return [baseTimeEntry];
      },
      async insertTimeEntry(input) {
        calls.push(`insert:${input.startTime}-${input.endTime}:${input.note}`);
        return insertedEntry;
      },
      async updateTimeEntry() {
        calls.push('update');
        throw new Error('update should not be called');
      },
      async softDeleteTimeEntry() {
        throw new Error('soft delete should not be called');
      },
    }).createTimeEntry({
      date: '2026-05-21',
      startTime: '14:20',
      endTime: '14:50',
      categoryId: 'category:study',
      note: '다른 메모',
      now: '2026-05-21T05:20:00.000Z',
    });

    expect(calls).toEqual(['list:2026-05-21', 'insert:14:20-14:50:다른 메모']);
    expect(result).toBe(insertedEntry);
  });

  it('keeps an existing matching entry when the new range is inside it', async () => {
    const calls: string[] = [];
    const unchangedEntry = {
      ...baseTimeEntry,
      startTime: '14:00',
      endTime: '15:00',
      updatedAt: '2026-05-21T05:20:00.000Z',
    };

    const result = await createTimeEntryService({
      async listTimeEntriesByDate(date) {
        calls.push(`list:${date}`);
        return [unchangedEntry];
      },
      async insertTimeEntry() {
        calls.push('insert');
        throw new Error('insert should not be called');
      },
      async updateTimeEntry(input) {
        calls.push(`update:${input.id}:${input.startTime}-${input.endTime}`);
        expect(input).toMatchObject({
          id: unchangedEntry.id,
          startTime: '14:00',
          endTime: '15:00',
          now: '2026-05-21T05:20:00.000Z',
        });
        return unchangedEntry;
      },
      async softDeleteTimeEntry() {
        calls.push('delete');
        throw new Error('soft delete should not be called');
      },
    }).createTimeEntry({
      date: '2026-05-21',
      startTime: '14:20',
      endTime: '14:40',
      categoryId: 'category:study',
      now: '2026-05-21T05:20:00.000Z',
    });

    expect(calls).toEqual(['list:2026-05-21', 'update:timeEntry:1:14:00-15:00']);
    expect(result).toBe(unchangedEntry);
  });
});

describe('upsertAndReloadWeekReviewWithRepository', () => {
  it('returns the server row fetched after saving', async () => {
    const calls: string[] = [];

    const result = await upsertAndReloadWeekReviewWithRepository(
      {
        async upsertWeekReview() {
          calls.push('upsert');
          return { ...reloadedReview, updatedAt: input.now ?? reloadedReview.updatedAt };
        },
        async getWeekReviewByWeekStartDate(weekStartDate) {
          calls.push(`get:${weekStartDate}`);
          return reloadedReview;
        },
      },
      input,
    );

    expect(calls).toEqual(['upsert', 'get:2026-05-18']);
    expect(result).toBe(reloadedReview);
  });

  it('raises a retryable storage error when the saved review cannot be reloaded', async () => {
    await expect(
      upsertAndReloadWeekReviewWithRepository(
        {
          async upsertWeekReview() {
            return reloadedReview;
          },
          async getWeekReviewByWeekStartDate() {
            return null;
          },
        },
        input,
      ),
    ).rejects.toBeInstanceOf(SupabaseStorageError);
  });
});
