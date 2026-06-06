import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { getOAuthUrl } from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const nonce = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  redirect(getOAuthUrl(nonce, request.nextUrl.origin));
}
