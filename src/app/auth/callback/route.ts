import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/google/crypto";
import { googleIntegrationRepository } from "@/server/repositories/google-integration.repository";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const { session } = data;

      if (session.provider_token && session.provider_refresh_token && session.user.email) {
        try {
          await googleIntegrationRepository.upsert(session.user.id, {
            googleAccountEmail: session.user.email,
            accessTokenEncrypted: encrypt(session.provider_token),
            refreshTokenEncrypted: encrypt(session.provider_refresh_token),
            tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
          });
        } catch (err) {
          console.error("[auth/callback] google integration save failed:", err);
        }
      }

      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", origin));
}
