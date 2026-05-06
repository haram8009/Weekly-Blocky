export type WeekStartDay = 'monday' | 'sunday';

export type LocalAppSettings = {
  weekStartDay: WeekStartDay;
  defaultDayStartTime: string;
  timeZone: 'local';
  hasCompletedLocalSetup: boolean;
};

export const defaultLocalAppSettings: LocalAppSettings = {
  weekStartDay: 'monday',
  defaultDayStartTime: '06:00',
  timeZone: 'local',
  hasCompletedLocalSetup: false,
};

export function createInitialLocalSettings(
  overrides: Partial<LocalAppSettings> = {},
): LocalAppSettings {
  return {
    ...defaultLocalAppSettings,
    ...overrides,
  };
}
