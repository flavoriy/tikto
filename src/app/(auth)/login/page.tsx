import { LoginCard } from "@/components/auth/login-card";
import { getSupabaseConfig } from "@/lib/supabase/env";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  auth_callback_failed: "Google sign-in did not complete. Please try again.",
  oauth_account_mismatch: "The connected Google account must match the signed-in account.",
  profile_not_ready: "Your account exists, but the app profile is missing. Run the Supabase setup SQL, then sign in again.",
};

function getConfiguredAppOrigin() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    return null;
  }

  try {
    const url = new URL(appUrl);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";

    if (process.env.NODE_ENV === "production" && isLocalhost) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const message = query.error ? errorMessages[query.error] ?? "Authentication failed." : null;
  const { url, publishableKey } = getSupabaseConfig();

  return (
    <LoginCard
      errorMessage={message}
      supabaseConfigured={Boolean(url && publishableKey)}
      appOrigin={getConfiguredAppOrigin()}
    />
  );
}
