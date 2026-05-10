import { ensureCurrentUserBootstrapData } from '@weekly/data';

import { getSupabaseClient } from './client';

export function ensureMobileUserBootstrapData() {
  return ensureCurrentUserBootstrapData(getSupabaseClient());
}
