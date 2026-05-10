import { ensureDefaultSettings, getSettings } from '@weekly/data';

import { getSupabaseClient } from './client';

export function getMobileSettings() {
  return getSettings(getSupabaseClient());
}

export function ensureMobileDefaultSettings() {
  return ensureDefaultSettings(getSupabaseClient());
}
