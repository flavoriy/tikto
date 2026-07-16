export function getSupabaseUrl() {
  const globalWindow = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
  if (globalWindow && globalWindow.__ENV?.NEXT_PUBLIC_SUPABASE_URL) {
    return globalWindow.__ENV.NEXT_PUBLIC_SUPABASE_URL;
  }
  const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;
  return env.NEXT_PUBLIC_SUPABASE_URL || env["NEXT_PUBLIC_SUPABASE_URL"];
}

export function getSupabasePublishableKey() {
  const globalWindow = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
  if (globalWindow && globalWindow.__ENV?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return globalWindow.__ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
  const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;
  return (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ||
    env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
  );
}

export function getSupabaseConfig() {
  return {
    url: getSupabaseUrl(),
    publishableKey: getSupabasePublishableKey(),
  };
}

export function assertSupabaseConfig() {
  const config = getSupabaseConfig();

  return {
    url: config.url || "",
    publishableKey: config.publishableKey || "",
  };
}
