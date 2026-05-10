import {
  createTimeEntriesCsv,
  type Category,
  type TimeEntry,
  type TimeEntryCsvInput,
} from '@weekly/domain';

type CreateWebTimeEntriesCsvInput = {
  entries: readonly TimeEntry[];
  categories: readonly Category[];
  photoCountsByEntryId: ReadonlyMap<string, number>;
};

const FALLBACK_CATEGORY: Pick<Category, 'name' | 'color' | 'emoji'> = {
  name: '카테고리 없음',
  color: '#64748B',
  emoji: '•',
};

export function createWebTimeEntriesCsv({
  entries,
  categories,
  photoCountsByEntryId,
}: CreateWebTimeEntriesCsvInput): string {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const csvEntries = entries
    .filter((entry) => !entry.deletedAt)
    .map((entry): TimeEntryCsvInput => {
      const category = categoryById.get(entry.categoryId) ?? FALLBACK_CATEGORY;

      return {
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        categoryName: category.name,
        categoryColor: category.color,
        categoryEmoji: category.emoji,
        note: entry.note,
        source: entry.source,
        photoCount: photoCountsByEntryId.get(entry.id) ?? 0,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      };
    });

  return createTimeEntriesCsv(csvEntries);
}
