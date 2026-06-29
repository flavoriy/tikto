import { LoginCard } from "@/components/auth/login-card";
import { getSupabaseConfig } from "@shared/supabase/env";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  auth_callback_failed: "Sign-in did not complete. Please try again.",
  profile_not_ready: "Your account exists, but the app profile is missing. Run the Supabase setup SQL, then sign in again.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const message = query.error ? errorMessages[query.error] ?? "Authentication failed." : null;
  const { url, publishableKey } = getSupabaseConfig();

  return (
    <LoginCard
      errorMessage={message}
      supabaseConfigured={Boolean(url && publishableKey)}
    />
  );
}