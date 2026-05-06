const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export type SupabaseEnvStatus = {
  isConfigured: boolean;
  missingKeys: string[];
};

export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const envEntries: Array<[string, string | undefined]> = [
    ['NEXT_PUBLIC_SUPABASE_URL', supabaseUrl],
    ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', supabasePublishableKey],
  ];

  const missingKeys = envEntries.filter(([, value]) => !value).map(([key]) => key);

  return {
    isConfigured: missingKeys.length === 0,
    missingKeys,
  };
}

export function getSupabaseEnv() {
  const status = getSupabaseEnvStatus();

  if (!status.isConfigured) {
    throw new Error(`Supabase 환경 변수가 비어 있습니다: ${status.missingKeys.join(', ')}`);
  }

  return {
    url: supabaseUrl!,
    publishableKey: supabasePublishableKey!,
  };
}
