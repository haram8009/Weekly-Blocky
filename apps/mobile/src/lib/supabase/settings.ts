import {
  ensureDefaultSettings,
  getSettings,
  updateSettings,
  type UpdateSettingsInput,
} from '@weekly/data';

import { getSupabaseClient } from './client';

export function getMobileSettings() {
  return getSettings(getSupabaseClient());
}

export function ensureMobileDefaultSettings() {
  return ensureDefaultSettings(getSupabaseClient());
}

export function updateMobileSettings(input: UpdateSettingsInput) {
  return updateSettings(getSupabaseClient(), input);
}

export type { UpdateSettingsInput } from '@weekly/data';
