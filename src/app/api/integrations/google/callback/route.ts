import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { encrypt } from "@/lib/google/crypto";
import { exchangeCode, getGoogleUserEmail } from "@/lib/google/oauth";
import { googleIntegrationRepository } from "@/server/repositories/google-integration.repository";

export async function GET(req: NextRequest) {
  const user = await requireAuthenticatedUser();

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    redirect(`/integrations?error=${encodeURIComponent(oauthError)}`);
  }

  const cookieStore = await cookies();
  const storedNonce = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");

  if (!storedNonce || storedNonce !== state) {
    redirect("/integrations?error=invalid_state");
  }

  if (!code) {
    redirect("/integrations?error=missing_code");
  }

  let redirectTarget = "/integrations?connected=1";

  try {
    const tokens = await exchangeCode(code, req.nextUrl.origin);

    if (!tokens.refresh_token) {
      redirectTarget = "/integrations?error=no_refresh_token";
    } else {
      const email = await getGoogleUserEmail(tokens.access_token);
      const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      await googleIntegrationRepository.upsert(user.id, {
        googleAccountEmail: email,
        accessTokenEncrypted: encrypt(tokens.access_token),
        refreshTokenEncrypted: encrypt(tokens.refresh_token),
        tokenExpiresAt,
      });
    }
  } catch {
    redirectTarget = "/integrations?error=token_exchange_failed";
  }

  redirect(redirectTarget);
}
