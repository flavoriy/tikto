"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await fetch("/api/auth/sign-out", { method: "POST" });
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isPending}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-border bg-white px-3 py-2 text-[12px] font-medium text-muted hover:text-foreground disabled:opacity-50",
      )}
    >
      <LogOut className="size-3.5" />
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
