import type { AppSettings, EntityId, TimestampString } from './index';

export type DefaultAppSettingsValues = Pick<
  AppSettings,
  | 'weekStartsOn'
  | 'visibleStartTime'
  | 'visibleEndTime'
  | 'useFullDayView'
  | 'photoMatchingEnabled'
  | 'thumbnailSyncEnabled'
  | 'lastOpenedWeekStartDate'
>;

export const DEFAULT_APP_SETTINGS = {
  weekStartsOn: 'monday',
  visibleStartTime: '05:00',
  visibleEndTime: '24:00',
  useFullDayView: false,
  photoMatchingEnabled: false,
  thumbnailSyncEnabled: false,
  lastOpenedWeekStartDate: null,
} as const satisfies DefaultAppSettingsValues;

export type ExampleCategoryDefinition = {
  key: string;
  name: string;
  color: string;
  emoji: string;
  weeklyGoalMinutes: number | null;
  sortOrder: number;
};

export const EXAMPLE_CATEGORY_DEFINITIONS = [
  {
    key: 'sleep',
    name: '수면',
    color: '#6D5BD0',
    emoji: '😴',
    weeklyGoalMinutes: null,
    sortOrder: 10,
  },
  {
    key: 'commute_meals',
    name: '이동/식사',
    color: '#F59E0B',
    emoji: '🍽️',
    weeklyGoalMinutes: null,
    sortOrder: 20,
  },
  {
    key: 'work_study',
    name: '공부/주요 업무',
    color: '#2563EB',
    emoji: '📚',
    weeklyGoalMinutes: null,
    sortOrder: 30,
  },
  {
    key: 'self_development',
    name: '자기개발',
    color: '#10B981',
    emoji: '🌱',
    weeklyGoalMinutes: null,
    sortOrder: 40,
  },
  {
    key: 'spiritual_time',
    name: '영적시간',
    color: '#8B5CF6',
    emoji: '🙏',
    weeklyGoalMinutes: null,
    sortOrder: 50,
  },
  {
    key: 'exercise_health',
    name: '운동/건강',
    color: '#EF4444',
    emoji: '💪',
    weeklyGoalMinutes: null,
    sortOrder: 60,
  },
  {
    key: 'family_relationships',
    name: '가족/관계',
    color: '#EC4899',
    emoji: '👨‍👩‍👧‍👦',
    weeklyGoalMinutes: null,
    sortOrder: 70,
  },
  {
    key: 'chores_errands',
    name: '집안일/심부름',
    color: '#14B8A6',
    emoji: '🧹',
    weeklyGoalMinutes: null,
    sortOrder: 80,
  },
  {
    key: 'rest',
    name: '휴식',
    color: '#64748B',
    emoji: '☕',
    weeklyGoalMinutes: null,
    sortOrder: 90,
  },
  {
    key: 'wasted_time',
    name: '낭비한 시간',
    color: '#1F2937',
    emoji: '⚠️',
    weeklyGoalMinutes: null,
    sortOrder: 100,
  },
] as const satisfies readonly ExampleCategoryDefinition[];

export type ExampleCategoryKey = (typeof EXAMPLE_CATEGORY_DEFINITIONS)[number]['key'];

export type CreateDefaultAppSettingsOptions = {
  userId: EntityId;
  id?: EntityId;
  now?: TimestampString;
  overrides?: Partial<DefaultAppSettingsValues>;
};

export function getDefaultSettingsId(userId: EntityId): EntityId {
  return `settings:${userId}`;
}

export function createDefaultAppSettings({
  userId,
  id,
  now = new Date().toISOString(),
  overrides = {},
}: CreateDefaultAppSettingsOptions): AppSettings {
  return {
    id: id ?? getDefaultSettingsId(userId),
    userId,
    ...DEFAULT_APP_SETTINGS,
    ...overrides,
    createdAt: now,
    updatedAt: now,
  };
}
