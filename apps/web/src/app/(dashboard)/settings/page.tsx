import { SettingsForm } from "@/components/settings/settings-form";
import { getCurrentProfileOrRedirect } from "@/lib/auth/session";

export default async function SettingsPage() {
  const profile = await getCurrentProfileOrRedirect();

  return <SettingsForm profile={profile} />;
}
