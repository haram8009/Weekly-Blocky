import { ensureCurrentUserBootstrapData } from '@weekly/data';

import { getSupabaseClient } from './client';

export function ensureWebUserBootstrapData() {
  return ensureCurrentUserBootstrapData(getSupabaseClient());
}
