import { z } from "zod";

import { handleApiError, ok } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { decrypt, encrypt } from "@/lib/google/crypto";
import { checkTelegramBotStatus } from "@/lib/telegram/bot";
import { telegramIntegrationRepository } from "@/server/repositories/telegram-integration.repository";

const telegramIntegrationSchema = z.object({
  botToken: z.string().trim().max(240, "Bot token is too long.").optional(),
  chatId: z.string().trim().min(1, "Chat ID is required.").max(120),
  telegramUsername: z.string().trim().max(120).optional(),
  isEnabled: z.boolean(),
});

function decryptBotToken(encrypted: string | null | undefined) {
  if (!encrypted) return undefined;
  return decrypt(encrypted);
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const integration = await telegramIntegrationRepository.findByUserId(user.id);
    let botToken: string | undefined;
    let botError: string | null = null;

    try {
      botToken = decryptBotToken(integration?.botTokenEncrypted);
    } catch {
      botError = "Saved bot token could not be decrypted. Replace it and save again.";
    }

    const status = await checkTelegramBotStatus({
      token: botToken,
      chatId: integration?.chatId ?? null,
      integrationSaved: Boolean(integration),
      remindersEnabled: integration?.isEnabled ?? false,
    });

    if (botError) {
      status.botConfigured = true;
      status.botReachable = false;
      status.botError = botError;
    }

    return ok({ status });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const payload = telegramIntegrationSchema.parse(await request.json());

    if (!(await telegramIntegrationRepository.hasBotTokenColumn())) {
      throw new AppError(
        500,
        "TELEGRAM_SCHEMA_OUT_OF_DATE",
        "The database is missing telegram_integrations.bot_token_encrypted. Run the latest Supabase schema SQL before saving Telegram settings.",
      );
    }

    const existing = await telegramIntegrationRepository.findByUserId(user.id);
    const botTokenEncrypted = payload.botToken ? encrypt(payload.botToken) : undefined;

    if (!existing?.botTokenEncrypted && !botTokenEncrypted) {
      throw new AppError(400, "BOT_TOKEN_REQUIRED", "Bot token is required for the first Telegram setup.");
    }

    const integration = await telegramIntegrationRepository.upsert(user.id, {
      botTokenEncrypted,
      chatId: payload.chatId,
      telegramUsername: payload.telegramUsername || null,
      isEnabled: payload.isEnabled,
    });

    return ok({ integration });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireAuthenticatedUser();
    await telegramIntegrationRepository.deleteByUserId(user.id);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
