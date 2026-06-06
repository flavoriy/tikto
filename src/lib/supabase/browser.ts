import { createBrowserClient } from "@supabase/ssr";

import { assertSupabaseConfig } from "@/lib/supabase/env";

export function createClient() {
  const { url, publishableKey } = assertSupabaseConfig();

  return createBrowserClient(url, publishableKey);
}
