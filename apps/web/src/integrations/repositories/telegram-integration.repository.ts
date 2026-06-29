import "server-only";

import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";

function isMissingBotTokenColumnError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.meta?.column === "telegram_integrations.bot_token_encrypted"
  );
}

function schemaOutOfDateError() {
  return new AppError(
    500,
    "TELEGRAM_SCHEMA_OUT_OF_DATE",
    "The database is missing telegram_integrations.bot_token_encrypted. Run the latest Supabase schema SQL before saving Telegram settings.",
  );
}

export const telegramIntegrationRepository = {
  async hasBotTokenColumn() {
    const result = await prisma.$queryRaw<{ exists: boolean }[]>`
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'telegram_integrations'
          and column_name = 'bot_token_encrypted'
      ) as "exists"
    `;

    return Boolean(result[0]?.exists);
  },

  async findByUserId(userId: string) {
    try {
      return await prisma.telegramIntegration.findUnique({
        where: { userId },
      });
    } catch (error) {
      if (!isMissingBotTokenColumnError(error)) {
        throw error;
      }

      const integration = await prisma.telegramIntegration.findUnique({
        where: { userId },
        select: {
          id: true,
          userId: true,
          chatId: true,
          telegramUsername: true,
          isEnabled: true,
          connectedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return integration ? { ...integration, botTokenEncrypted: null } : null;
    }
  },

  async upsert(
    userId: string,
    data: {
      botTokenEncrypted?: string;
      chatId: string;
      telegramUsername?: string | null;
      isEnabled: boolean;
    },
  ) {
    try {
      return await prisma.telegramIntegration.upsert({
        where: { userId },
        update: {
          ...(data.botTokenEncrypted ? { botTokenEncrypted: data.botTokenEncrypted } : {}),
          chatId: data.chatId,
          telegramUsername: data.telegramUsername ?? null,
          isEnabled: data.isEnabled,
        },
        create: {
          userId,
          botTokenEncrypted: data.botTokenEncrypted,
          chatId: data.chatId,
          telegramUsername: data.telegramUsername ?? null,
          isEnabled: data.isEnabled,
        },
      });
    } catch (error) {
      if (isMissingBotTokenColumnError(error)) {
        throw schemaOutOfDateError();
      }

      throw error;
    }
  },

  deleteByUserId(userId: string) {
    return prisma.telegramIntegration.deleteMany({
      where: { userId },
    });
  },
};
