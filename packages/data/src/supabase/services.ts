import type { DateString, TimeEntry } from '@weekly/domain';
import { validateTimeRange } from '@weekly/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseStorageError } from './errors';
import { SupabaseTimeEntryRepository } from './repositories';
import type { CreateTimeEntryInput, DeleteTimeEntryInput, UpdateTimeEntryInput } from './types';

export class SupabaseTimeEntryService {
  private readonly repository: SupabaseTimeEntryRepository;

  constructor(client: SupabaseClient) {
    this.repository = new SupabaseTimeEntryRepository(client);
  }

  async createTimeEntry(input: CreateTimeEntryInput): Promise<TimeEntry> {
    assertValidTimeRange(input.startTime, input.endTime);

    return this.repository.insertTimeEntry(input);
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

    assertValidTimeRange(
      input.startTime ?? existingEntry.startTime,
      input.endTime ?? existingEntry.endTime,
    );

    return this.repository.updateTimeEntry(input);
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
}

export function createTimeEntry(client: SupabaseClient, input: CreateTimeEntryInput): Promise<TimeEntry> {
  return new SupabaseTimeEntryService(client).createTimeEntry(input);
}

export function updateTimeEntry(client: SupabaseClient, input: UpdateTimeEntryInput): Promise<TimeEntry> {
  return new SupabaseTimeEntryService(client).updateTimeEntry(input);
}

export function deleteTimeEntry(client: SupabaseClient, input: DeleteTimeEntryInput): Promise<TimeEntry> {
  return new SupabaseTimeEntryService(client).deleteTimeEntry(input);
}

export function listTimeEntriesByDate(client: SupabaseClient, date: DateString): Promise<TimeEntry[]> {
  return new SupabaseTimeEntryService(client).listTimeEntriesByDate(date);
}

export function listTimeEntriesByWeek(client: SupabaseClient, weekStartDate: DateString): Promise<TimeEntry[]> {
  return new SupabaseTimeEntryService(client).listTimeEntriesByWeek(weekStartDate);
}

function assertValidTimeRange(startTime: string, endTime: string): void {
  const result = validateTimeRange(startTime, endTime);

  if (!result.isValid) {
    throw new SupabaseStorageError(
      'VALIDATION_FAILED',
      '시간은 10분 단위이며 종료 시간이 시작 시간보다 늦어야 합니다.',
      `Invalid time range: ${startTime}-${endTime} (${result.errors.join(', ')})`,
    );
  }
}
