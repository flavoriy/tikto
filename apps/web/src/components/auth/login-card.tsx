"use client";

import { useState } from "react";
import { ArrowRight, CheckCheck, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";
import pkg from "../../../package.json";

export function LoginCard({
  errorMessage,
  supabaseConfigured,
}: {
  errorMessage: string | null;
  supabaseConfigured: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseConfigured) {
      setLocalError("Supabase is not configured.");
      return;
    }

    if (!email || !password) {
      setLocalError("Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    setLocalError(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });

          if (signUpError) {
            setLocalError(error.message);
            setIsLoading(false);
            return;
          }

          if (signUpData.session) {
            router.push("/dashboard");
            router.refresh();
          } else {
            setSuccessMessage(
              "Account created. Please check your email to verify your account, then sign in.",
            );
            setIsLoading(false);
          }
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setLocalError(error.message);
          setIsLoading(false);
          return;
        }

        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setSuccessMessage(
            "Account created. Please check your email to verify your account, then sign in.",
          );
          setIsLoading(false);
        }
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Authentication failed.");
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
              <p className="mt-1 text-sm text-muted">Daily planning with focused backend services.</p>
            </div>
          </div>
          <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.04em] md:text-5xl">
            Stay on top of tasks without turning your day into dashboard noise.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted md:text-lg">
            Plan in a simple list-first workspace backed by separate profile, task, calendar, and dashboard services.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Daily focus", "Keep today visible with a clean task list and a short agenda."],
              ["Task service", "Create, update, complete, and reopen work items independently."],
              ["Calendar service", "Track events and calendar views without integration side effects."],
            ].map(([title, copy]) => (
              <div key={title} className="panel-muted rounded-[18px] p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-panel flex flex-col justify-between rounded-[28px] bg-white p-6 md:p-7">
          <div>
            <p className="section-label">Access Account</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Welcome to TikTo</h2>

            <div className="mt-5 flex rounded-[10px] bg-[var(--panel-muted)] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 rounded-[8px] py-1.5 text-center text-sm font-medium transition ${
                  mode === "signin"
                    ? "bg-white text-foreground shadow-xs font-semibold"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 rounded-[8px] py-1.5 text-center text-sm font-medium transition ${
                  mode === "signup"
                    ? "bg-white text-foreground shadow-xs font-semibold"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
            {!supabaseConfigured ? (
              <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Supabase is not configured on this deployment. Add `NEXT_PUBLIC_SUPABASE_URL` and
                `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then redeploy.
              </div>
            ) : null}
            {localError ? (
              <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {localError}
              </div>
            ) : null}
            {successMessage ? (
              <div className="mt-4 rounded-[14px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            ) : null}

            <form onSubmit={handleEmailAuth} className="mt-5 space-y-4">
              <div className="space-y-1">
                <label htmlFor="email" className="text-[11px] font-semibold tracking-wider text-muted uppercase">Email Address</label>
                <div className="relative">
                  <Mail className="absolute top-3.5 left-3 size-4 text-muted" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="text-[11px] font-semibold tracking-wider text-muted uppercase">Password</label>
                <div className="relative">
                  <Lock className="absolute top-3.5 left-3 size-4 text-muted" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-6 w-full"
                variant="primary"
                disabled={isLoading || !supabaseConfigured}
              >
                {isLoading ? (
                  <span>Processing...</span>
                ) : (
                  <span className="flex w-full items-center justify-between font-semibold">
                    <span>{mode === "signin" ? "Sign In" : "Sign Up"}</span>
                    <ArrowRight className="size-4" />
                  </span>
                )}
              </Button>
            </form>
          </div>

          <div className="mt-8">
            <p className="text-xs leading-5 text-muted">
              Integration login and background sync are disabled in this focused microservice build.
            </p>
          </div>
        </section>
      </div>

      <div className="fixed right-6 bottom-6 z-50">
        <div className="flex cursor-default items-center gap-2 rounded-xl border border-border bg-white/80 px-4 py-2.5 shadow-lg backdrop-blur-md select-none transition-transform duration-200 hover:scale-105">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          <span className="text-[14px] font-extrabold tracking-tight text-foreground">
            {process.env.NEXT_PUBLIC_APP_VERSION || `v${pkg.version}`}
          </span>
        </div>
      </div>
    </main>
  );
}
