'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseEnv } from './env';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, publishableKey } = getSupabaseEnv();

  supabaseClient = createClient(url, publishableKey);

  return supabaseClient;
}
