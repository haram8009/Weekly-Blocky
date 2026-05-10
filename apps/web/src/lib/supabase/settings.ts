import { ensureDefaultSettings, getSettings } from '@weekly/data';

import { getSupabaseClient } from './client';

export function getWebSettings() {
  return getSettings(getSupabaseClient());
}

export function ensureWebDefaultSettings() {
  return ensureDefaultSettings(getSupabaseClient());
}
