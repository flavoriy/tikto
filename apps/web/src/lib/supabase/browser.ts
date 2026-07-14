import { createBrowserClient } from "@supabase/ssr";

import { assertSupabaseConfig } from "@shared/supabase/env";

export function createClient() {
  const { url, publishableKey } = assertSupabaseConfig();

  return createBrowserClient(url, publishableKey);
}
