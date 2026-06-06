"use client";

import { useState } from "react";
import { ArrowRight, CheckCheck, LogIn } from "lucide-react";

import { createClient } from "@/lib/supabase/browser";

export function LoginCard({
  errorMessage,
  supabaseConfigured,
  appOrigin,
}: {
  errorMessage: string | null;
  supabaseConfigured: boolean;
  appOrigin: string | null;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleLogin() {
    if (!supabaseConfigured) {
      setLocalError("Supabase is missing on Vercel. Add NEXT_PUBLIC_SUPABASE_URL and a Supabase public key, then redeploy.");
      return;
    }

    setIsLoading(true);
    setLocalError(null);

    try {
      const supabase = createClient();
      const redirectOrigin = appOrigin ?? window.location.origin;
      const redirectTo = `${redirectOrigin}/auth/callback?next=/dashboard`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setLocalError(error.message);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not start Google sign-in.");
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-5 md:grid-cols-[1.15fr_0.85fr]">
        <section className="surface-panel rounded-[28px] p-7 md:p-10">
          <div className="flex items-center gap-4">
            <span className="inline-flex size-14 items-center justify-center rounded-[16px] bg-accent text-white shadow-[0_10px_20px_rgba(22,163,74,0.16)]">
              <CheckCheck className="size-7" />
            </span>
            <div>
              <p className="text-3xl font-semibold tracking-[-0.04em]">TikTo</p>
              <p className="mt-1 text-sm text-muted">Classic daily planning with optional sync.</p>
            </div>
          </div>
          <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.04em] md:text-5xl">
            Stay on top of tasks without turning your day into dashboard noise.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted md:text-lg">
            Plan in a simple list-first workspace, then connect Google Calendar, Google Tasks, or Telegram only where they add value.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Daily focus", "Keep today visible with a clean task list and a short agenda."],
              ["Google sync", "Use one Google account for sign-in, calendar, and tasks when ready."],
              ["Telegram setup", "Store reminder settings inside the app instead of scattered configs."],
            ].map(([title, copy]) => (
              <div key={title} className="panel-muted rounded-[18px] p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-panel flex flex-col justify-between rounded-[28px] p-6 md:p-7">
          <div>
            <p className="section-label">Sign in</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Continue with Google</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Use the Google account you want to keep connected for calendar and task sync.
            </p>

            {errorMessage ? (
              <div className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
            {!supabaseConfigured ? (
              <div className="mt-5 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Supabase is not configured on this deployment. Add `NEXT_PUBLIC_SUPABASE_URL` and
                `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel, then redeploy.
              </div>
            ) : null}
            {localError ? (
              <div className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {localError}
              </div>
            ) : null}
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoading || !supabaseConfigured}
              className="inline-flex w-full items-center justify-between rounded-[14px] bg-accent px-4 py-3.5 text-left text-white shadow-[0_10px_24px_rgba(22,163,74,0.18)] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="inline-flex items-center gap-3 font-medium">
                <LogIn className="size-5" />
                {isLoading ? "Redirecting to Google..." : "Continue with Google"}
              </span>
              <ArrowRight className="size-5" />
            </button>

            <p className="mt-4 text-xs leading-5 text-muted">
              You can start local-first, then enable calendar and task sync from Integrations when the flow is ready.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
