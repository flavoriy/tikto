import "server-only";

import { Client } from "@upstash/qstash";

import { AppError } from "@/lib/errors";

export type ReminderWebhookPayload = {
  reminderId: string;
  userId: string;
  targetType: "TASK" | "EVENT";
  targetId: string;
};

export type ReminderScheduler = {
  scheduleReminderDelivery(payload: ReminderWebhookPayload, remindAtUtc: Date): Promise<{ messageId: string }>;
  cancelReminderDelivery(messageId: string): Promise<void>;
};

let client: Client | null = null;

function getQStashClient() {
  const token = process.env.QSTASH_TOKEN;

  if (!token) {
    throw new AppError(500, "QSTASH_NOT_CONFIGURED", "QStash is not configured.");
  }

  client ??= new Client({ token });
  return client;
}

function getReminderWebhookUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new AppError(500, "APP_URL_NOT_CONFIGURED", "NEXT_PUBLIC_APP_URL is not configured.");
  }

  return new URL("/api/webhooks/qstash-reminder", appUrl).toString();
}

export const qstashReminderScheduler: ReminderScheduler = {
  async scheduleReminderDelivery(payload, remindAtUtc) {
    const result = await getQStashClient().publishJSON({
      url: getReminderWebhookUrl(),
      body: payload,
      notBefore: Math.floor(remindAtUtc.getTime() / 1000),
      retries: 3,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return { messageId: result.messageId };
  },

  async cancelReminderDelivery(messageId) {
    await getQStashClient().messages.cancel(messageId);
  },
};
