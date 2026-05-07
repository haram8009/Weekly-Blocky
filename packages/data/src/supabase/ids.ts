export function createEntityId(prefix: string): string {
  const randomUUID = globalThis.crypto?.randomUUID?.();

  if (randomUUID) {
    return `${prefix}:${randomUUID}`;
  }

  const randomText = Math.random().toString(36).slice(2, 12);
  return `${prefix}:${Date.now().toString(36)}:${randomText}`;
}

export function createWeekReviewId(userId: string, weekStartDate: string): string {
  return `weekReview:${userId}:${weekStartDate}`;
}
