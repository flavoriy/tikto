import { TelegramSettingsCard } from "@/components/integrations/telegram-settings-card";
import { GoogleSettingsCard } from "@/components/integrations/google-settings-card";
import { getCurrentProfileOrRedirect } from "@/lib/auth/session";
import { telegramIntegrationRepository } from "@/server/repositories/telegram-integration.repository";
import { googleIntegrationRepository } from "@/server/repositories/google-integration.repository";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfileOrRedirect();
  const params = await searchParams;

  const [telegramIntegration, googleIntegration, telegramBotTokenColumnReady] = await Promise.all([
    telegramIntegrationRepository.findByUserId(profile.id),
    googleIntegrationRepository.findByUserId(profile.id),
    telegramIntegrationRepository.hasBotTokenColumn(),
  ]);

  const appUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);
  const qstashConfigured = Boolean(process.env.QSTASH_TOKEN);
  const qstashSigningConfigured = Boolean(
    process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY,
  );

  return (
    <div className="space-y-4">
      <div className="surface-panel rounded-[24px] p-5 md:p-6">
        <p className="section-label">Integrations</p>
        <h1 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em]">Connect what you need</h1>
        <p className="mt-2 text-sm text-muted">Google for sync, Telegram for reminders.</p>
      </div>

      <div className="grid gap-4">
        <TelegramSettingsCard
          integration={
            telegramIntegration
              ? {
                  chatId: telegramIntegration.chatId,
                  telegramUsername: telegramIntegration.telegramUsername,
                  isEnabled: telegramIntegration.isEnabled,
                }
              : null
          }
          botTokenSaved={Boolean(telegramIntegration?.botTokenEncrypted)}
          botTokenStorageReady={telegramBotTokenColumnReady}
          appUrlConfigured={appUrlConfigured}
          qstashConfigured={qstashConfigured}
          qstashSigningConfigured={qstashSigningConfigured}
        />

        <GoogleSettingsCard
          integration={
            googleIntegration
              ? {
                  googleAccountEmail: googleIntegration.googleAccountEmail,
                  calendarEnabled: googleIntegration.calendarEnabled,
                  tasksEnabled: googleIntegration.tasksEnabled,
                  calendarImportState: googleIntegration.calendarImportState,
                  tasksImportState: googleIntegration.tasksImportState,
                }
              : null
          }
          errorParam={params.error ?? null}
        />
      </div>
    </div>
  );
}
