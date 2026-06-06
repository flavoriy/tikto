import "server-only";

type TelegramApiSuccess<T> = {
  ok: true;
  result: T;
};

type TelegramApiFailure = {
  ok: false;
  description?: string;
  error_code?: number;
};

type TelegramBotProfile = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
};

type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramMessage = {
  message_id: number;
  date: number;
  chat: TelegramChat;
};

const TELEGRAM_REQUEST_TIMEOUT_MS = 8000;

export type TelegramBotStatus = {
  botConfigured: boolean;
  botReachable: boolean;
  botDisplayName: string | null;
  botUsername: string | null;
  appUrlConfigured: boolean;
  qstashConfigured: boolean;
  qstashSigningConfigured: boolean;
  deliveryInfrastructureReady: boolean;
  integrationSaved: boolean;
  remindersEnabled: boolean;
  chatConfigured: boolean;
  chatReachable: boolean | null;
  chatDisplayName: string | null;
  botError: string | null;
  chatError: string | null;
  checkedAt: string;
};

async function fetchTelegram(input: string | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Telegram request timed out. Check the bot token or network access.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function telegramRequest<T>(
  token: string,
  method: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetchTelegram(url, {
    cache: "no-store",
  });

  const payload = (await response.json()) as TelegramApiSuccess<T> | TelegramApiFailure;

  if (!response.ok || !payload.ok) {
    const description = "description" in payload ? payload.description : undefined;
    throw new Error(description ?? `Telegram ${method} failed.`);
  }

  return payload.result;
}

async function telegramJsonRequest<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetchTelegram(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as TelegramApiSuccess<T> | TelegramApiFailure;

  if (!response.ok || !payload.ok) {
    const description = "description" in payload ? payload.description : undefined;
    throw new Error(description ?? `Telegram ${method} failed.`);
  }

  return payload.result;
}

function formatChatDisplayName(chat: TelegramChat): string {
  if (chat.title) return chat.title;
  if (chat.username) return `@${chat.username}`;
  return [chat.first_name, chat.last_name].filter(Boolean).join(" ") || String(chat.id);
}

export async function sendTelegramMessage(input: {
  token: string | undefined;
  chatId: string;
  text: string;
}) {
  if (!input.token) {
    throw new Error("Telegram bot token is missing.");
  }

  const message = await telegramJsonRequest<TelegramMessage>(input.token, "sendMessage", {
    chat_id: input.chatId,
    text: input.text,
    disable_web_page_preview: true,
  });

  return {
    messageId: message.message_id,
    chatId: String(message.chat.id),
    sentAt: new Date(message.date * 1000),
  };
}

export async function checkTelegramBotStatus(input: {
  token: string | undefined;
  chatId?: string | null;
  integrationSaved: boolean;
  remindersEnabled: boolean;
}): Promise<TelegramBotStatus> {
  const appUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);
  const qstashConfigured = Boolean(process.env.QSTASH_TOKEN);
  const qstashSigningConfigured = Boolean(
    process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY,
  );

  const status: TelegramBotStatus = {
    botConfigured: Boolean(input.token),
    botReachable: false,
    botDisplayName: null,
    botUsername: null,
    appUrlConfigured,
    qstashConfigured,
    qstashSigningConfigured,
    deliveryInfrastructureReady: Boolean(
      input.token && appUrlConfigured && qstashConfigured && qstashSigningConfigured,
    ),
    integrationSaved: input.integrationSaved,
    remindersEnabled: input.remindersEnabled,
    chatConfigured: Boolean(input.chatId),
    chatReachable: null,
    chatDisplayName: null,
    botError: null,
    chatError: null,
    checkedAt: new Date().toISOString(),
  };

  if (!input.token) {
    status.botError = "Telegram bot token is missing.";
    return status;
  }

  try {
    const bot = await telegramRequest<TelegramBotProfile>(input.token, "getMe");
    status.botReachable = true;
    status.botDisplayName = bot.first_name;
    status.botUsername = bot.username ? `@${bot.username}` : null;
  } catch (error) {
    status.botError = error instanceof Error ? error.message : "Could not reach Telegram bot.";
    return status;
  }

  if (!input.chatId) {
    return status;
  }

  try {
    const chat = await telegramRequest<TelegramChat>(input.token, "getChat", {
      chat_id: input.chatId,
    });
    status.chatReachable = true;
    status.chatDisplayName = formatChatDisplayName(chat);
  } catch (error) {
    status.chatReachable = false;
    status.chatError =
      error instanceof Error ? error.message : "Could not verify the configured Telegram chat.";
  }

  return status;
}
