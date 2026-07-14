import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { assertSupabaseConfig } from "@shared/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = assertSupabaseConfig();

  return createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies directly.
          }
        },
      },
    },
  );
}
