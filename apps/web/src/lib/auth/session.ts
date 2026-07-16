import "server-only";

import { cache } from "react";
import { redirect, unstable_rethrow } from "next/navigation";

import { AppError } from "@/lib/errors";
import {
  appendSupabaseUserHeaders,
  fetchTiktoApi,
  readTiktoApiData,
} from "@/lib/internal-services/internal";

export const getAuthenticatedUser = cache(async function getAuthenticatedUser() {
  return {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    email: "user@example.com",
  };
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

  try {
    const response = await fetchTiktoApi("/profile", {
      headers: appendSupabaseUserHeaders(new Headers(), user),
    });

    const { profile } = await readTiktoApiData<{
      profile: {
        id: string;
        email: string;
        name: string | null;
        avatarUrl: string | null;
        timezone: string;
        defaultTaskReminderOffsetsMinutes: number[];
        defaultEventReminderOffsetsMinutes: number[];
      };
    }>(response);

    return profile;
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