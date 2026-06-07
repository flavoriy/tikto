import "server-only";

import { cache } from "react";
import { redirect, unstable_rethrow } from "next/navigation";

import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export const getAuthenticatedUser = cache(async function getAuthenticatedUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth] Supabase auth check failed:", error);
    return null;
  }
});

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "You must be signed in.");
  }

  return user;
}

export const getCurrentProfile = cache(async function getCurrentProfile() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  const { prisma } = await import("@/lib/db/prisma");

  try {
    const profile = await prisma.profile.findUnique({
      where: {
        id: user.id,
      },
    });

    if (profile) {
      return profile;
    }

    // Fallback: create profile if database trigger wasn't run
    try {
      return await prisma.profile.create({
        data: {
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User",
          avatarUrl: user.user_metadata?.avatar_url ?? null,
          timezone: "Asia/Ho_Chi_Minh",
        },
      });
    } catch (createError) {
      console.error("[auth] Failed to automatically create profile fallback:", createError);
      return await prisma.profile.findUnique({
        where: {
          id: user.id,
        },
      });
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("[auth] profile lookup failed:", error);
    return null;
  }
});

export async function requireCurrentProfile() {
  const profile = await getCurrentProfile();

  if (!profile) {
    throw new AppError(
      500,
      "PROFILE_NOT_FOUND",
      "Your profile is not ready yet. Run the Supabase setup SQL and try again.",
    );
  }

  return profile;
}

export async function getCurrentProfileOrRedirect() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login?error=profile_not_ready");
  }

  return profile;
}
