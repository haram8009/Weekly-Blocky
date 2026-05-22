import type { DateString, EntityId, TimeString, TimestampString } from './index';
import { formatDiaryMinutesToTime, validateDiaryTimeRange } from './time';

export type EntryOverlapEntry = {
  id: EntityId;
  date: DateString;
  startTime: TimeString;
  endTime: TimeString;
  deletedAt: TimestampString | null;
};

export type IncomingEntryRange = {
  id?: EntityId;
  date: DateString;
  startTime: TimeString;
  endTime: TimeString;
};

export type EntryOverlapTimePatch = {
  startTime: TimeString;
  endTime: TimeString;
};

export type EntryOverlapUpdate<TEntry extends EntryOverlapEntry> = {
  entry: TEntry;
  patch: EntryOverlapTimePatch;
};

export type EntryOverlapSplit<TEntry extends EntryOverlapEntry> = {
  entry: TEntry;
  before: EntryOverlapTimePatch;
  after: EntryOverlapTimePatch;
};

export type EntryOverlapResolution<TEntry extends EntryOverlapEntry> = {
  untouched: TEntry[];
  updates: EntryOverlapUpdate<TEntry>[];
  deletes: TEntry[];
  splits: EntryOverlapSplit<TEntry>[];
};

export function resolveEntryOverlaps<TEntry extends EntryOverlapEntry>(
  existingEntries: readonly TEntry[],
  incomingEntry: IncomingEntryRange,
): EntryOverlapResolution<TEntry> {
  const incomingRange = parseValidRange(incomingEntry);
  const resolution: EntryOverlapResolution<TEntry> = {
    untouched: [],
    updates: [],
    deletes: [],
    splits: [],
  };

  for (const existingEntry of existingEntries) {
    if (
      existingEntry.id === incomingEntry.id ||
      existingEntry.date !== incomingEntry.date ||
      existingEntry.deletedAt !== null
    ) {
      resolution.untouched.push(existingEntry);
      continue;
    }

    const existingRange = parseValidRange(existingEntry);

    if (!rangesOverlap(existingRange, incomingRange)) {
      resolution.untouched.push(existingEntry);
      continue;
    }

    if (
      incomingRange.startMinutes <= existingRange.startMinutes &&
      incomingRange.endMinutes >= existingRange.endMinutes
    ) {
      resolution.deletes.push(existingEntry);
      continue;
    }

    if (
      existingRange.startMinutes < incomingRange.startMinutes &&
      existingRange.endMinutes > incomingRange.endMinutes
    ) {
      resolution.splits.push({
        entry: existingEntry,
        before: createPatch(existingRange.startMinutes, incomingRange.startMinutes),
        after: createPatch(incomingRange.endMinutes, existingRange.endMinutes),
      });
      continue;
    }

    if (existingRange.startMinutes < incomingRange.startMinutes) {
      resolution.updates.push({
        entry: existingEntry,
        patch: createPatch(existingRange.startMinutes, incomingRange.startMinutes),
      });
      continue;
    }

    resolution.updates.push({
      entry: existingEntry,
      patch: createPatch(incomingRange.endMinutes, existingRange.endMinutes),
    });
  }

  return resolution;
}

function parseValidRange(entry: IncomingEntryRange): {
  startMinutes: number;
  endMinutes: number;
} {
  const validation = validateDiaryTimeRange(entry.startTime, entry.endTime);

  if (!validation.isValid) {
    throw new Error(
      `기록 시간 범위가 올바르지 않습니다: ${entry.startTime}-${entry.endTime} (${validation.errors.join(', ')})`,
    );
  }

  return {
    startMinutes: validation.startMinutes,
    endMinutes: validation.endMinutes,
  };
}

function rangesOverlap(
  existingRange: { startMinutes: number; endMinutes: number },
  incomingRange: { startMinutes: number; endMinutes: number },
): boolean {
  return (
    existingRange.startMinutes < incomingRange.endMinutes &&
    existingRange.endMinutes > incomingRange.startMinutes
  );
}

function createPatch(startMinutes: number, endMinutes: number): EntryOverlapTimePatch {
  if (startMinutes >= endMinutes) {
    throw new Error(`겹침 처리 후 남은 기록 시간이 0분 이하입니다: ${startMinutes}-${endMinutes}`);
  }

  if (startMinutes % 10 !== 0 || endMinutes % 10 !== 0) {
    throw new Error(`겹침 처리 후 기록이 10분 단위에 맞지 않습니다: ${startMinutes}-${endMinutes}`);
  }

  return {
    startTime: formatDiaryMinutesToTime(startMinutes),
    endTime: formatDiaryMinutesToTime(endMinutes),
  };
}
