const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type MobileSupabaseEnvStatus = {
  isConfigured: boolean;
  missingKeys: string[];
};

export function getMobileSupabaseEnvStatus(): MobileSupabaseEnvStatus {
  const envEntries: Array<[string, string | undefined]> = [
    ['EXPO_PUBLIC_SUPABASE_URL', supabaseUrl],
    ['EXPO_PUBLIC_SUPABASE_ANON_KEY', supabaseAnonKey],
  ];

  const missingKeys = envEntries.filter(([, value]) => !value).map(([key]) => key);

  return {
    isConfigured: missingKeys.length === 0,
    missingKeys,
  };
}

export function getMobileSupabaseEnv() {
  const status = getMobileSupabaseEnvStatus();

  if (!status.isConfigured) {
    throw new Error(`Supabase 환경 변수가 비어 있습니다: ${status.missingKeys.join(', ')}`);
  }

  return {
    url: supabaseUrl!,
    anonKey: supabaseAnonKey!,
  };
}
