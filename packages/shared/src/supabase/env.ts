interface CustomWindow {
  __ENV?: Record<string, string>;
}

export function getSupabaseUrl() {
  if (typeof window !== 'undefined') {
    const customWindow = window as unknown as CustomWindow;
    if (customWindow.__ENV?.NEXT_PUBLIC_SUPABASE_URL) {
      return customWindow.__ENV.NEXT_PUBLIC_SUPABASE_URL;
    }
  }
  const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;
  return env.NEXT_PUBLIC_SUPABASE_URL || env["NEXT_PUBLIC_SUPABASE_URL"];
}

export function getSupabasePublishableKey() {
  if (typeof window !== 'undefined') {
    const customWindow = window as unknown as CustomWindow;
    if (customWindow.__ENV?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      return customWindow.__ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    }
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
