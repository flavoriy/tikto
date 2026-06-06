import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/session";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>;
}) {
  const params = await searchParams;

  if (params.code || params.error) {
    const callbackParams = new URLSearchParams();

    if (params.code) callbackParams.set("code", params.code);
    if (params.error) callbackParams.set("error", params.error);
    if (params.error_description) callbackParams.set("error_description", params.error_description);
    callbackParams.set("next", "/dashboard");

    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  const profile = await getCurrentProfile();

  redirect(profile ? "/dashboard" : "/login");
}
