import { DEFAULT_APP_SETTINGS, type Weekday } from '@weekly/domain';

export type LocalAppSettings = {
  weekStartDay: Weekday;
  defaultDayStartTime: string;
  timeZone: 'local';
  hasCompletedLocalSetup: boolean;
};

export const defaultLocalAppSettings: LocalAppSettings = {
  weekStartDay: DEFAULT_APP_SETTINGS.weekStartsOn,
  defaultDayStartTime: DEFAULT_APP_SETTINGS.visibleStartTime,
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
