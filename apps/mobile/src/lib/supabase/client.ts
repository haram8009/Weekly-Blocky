import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getMobileSupabaseEnv } from './env';
import { secureStoreAdapter } from './secureStoreAdapter';

let mobileSupabaseClient: SupabaseClient | null = null;

export function createMobileSupabaseClient() {
  if (mobileSupabaseClient) {
    return mobileSupabaseClient;
  }

  const { url, anonKey } = getMobileSupabaseEnv();

  mobileSupabaseClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: secureStoreAdapter,
    },
  });

  return mobileSupabaseClient;
}
