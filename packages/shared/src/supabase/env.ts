export function getSupabaseUrl() {
  if (typeof window !== 'undefined' && (window as any).__ENV?.NEXT_PUBLIC_SUPABASE_URL) {
    return (window as any).__ENV.NEXT_PUBLIC_SUPABASE_URL;
  }
  const env = typeof process !== 'undefined' ? process.env : {};
  return env.NEXT_PUBLIC_SUPABASE_URL || env["NEXT_PUBLIC_SUPABASE_URL"];
}

export function getSupabasePublishableKey() {
  if (typeof window !== 'undefined' && (window as any).__ENV?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return (window as any).__ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
  const env = typeof process !== 'undefined' ? process.env : {};
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
