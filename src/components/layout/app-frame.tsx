import { Suspense } from "react";

import { getCurrentProfileOrRedirect } from "@/lib/auth/session";
import { DesktopNavigation, MobileNavigation } from "@/components/layout/navigation";
import { SignOutButton } from "@/components/layout/sign-out-button";

type AppFrameProps = {
  children: React.ReactNode;
};

async function ProfileHeader() {
  const profile = await getCurrentProfileOrRedirect();
  const profileName = profile.name ?? profile.email.split("@")[0] ?? "there";
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="mb-5 flex items-center justify-between gap-3 rounded-[16px] border border-border bg-white px-5 py-3.5 shadow-[var(--shadow-card)]">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold tracking-[-0.02em]">{profileName}</p>
        <p className="text-[12px] text-muted">{todayLabel} · {profile.timezone.replaceAll("_", " ")}</p>
      </div>
      <SignOutButton />
    </header>
  );
}

function ProfileHeaderFallback() {
  return (
    <header className="mb-5 flex items-center justify-between gap-3 rounded-[16px] border border-border bg-white px-5 py-3.5 shadow-[var(--shadow-card)]">
      <div className="min-w-0 flex-1 animate-pulse">
        <div className="h-5 w-36 rounded-full bg-slate-200" />
        <div className="mt-2 h-3 w-56 max-w-full rounded-full bg-slate-100" />
      </div>
      <SignOutButton />
    </header>
  );
}

export function AppFrame({ children }: AppFrameProps) {
  return (
    <div className="app-shell min-h-screen px-3 py-3 md:px-5 md:py-5">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1440px] gap-4 md:grid-cols-[240px_1fr]">
        <DesktopNavigation />

        <div className="flex min-w-0 flex-col pb-24 md:pb-0">
          <Suspense fallback={<ProfileHeaderFallback />}>
            <ProfileHeader />
          </Suspense>

          <main className="page-grid flex-1">{children}</main>
        </div>
      </div>
      <MobileNavigation />
    </div>
  );
}
