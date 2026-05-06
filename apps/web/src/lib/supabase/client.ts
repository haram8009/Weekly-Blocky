'use client';

import { createClient } from '@supabase/supabase-js';

import { getSupabaseEnv } from './env';

export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();

  return createClient(url, anonKey);
}
