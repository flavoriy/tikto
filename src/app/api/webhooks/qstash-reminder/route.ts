import { z } from "zod";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

import { fail, handleApiError, ok } from "@/lib/api";
import { deliverReminder } from "@/server/services/reminder.service";

const reminderWebhookSchema = z.object({
  reminderId: z.string().uuid(),
});

async function handleReminderWebhook(request: Request) {
  try {
    const payload = reminderWebhookSchema.parse(await request.json());
    const result = await deliverReminder(payload.reminderId);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
  ? new URL("/api/webhooks/qstash-reminder", process.env.NEXT_PUBLIC_APP_URL).toString()
  : undefined;

const hasSigningKeys = Boolean(
  process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY,
);

export const POST = hasSigningKeys
  ? verifySignatureAppRouter(handleReminderWebhook, webhookUrl ? { url: webhookUrl } : undefined)
  : async function missingSigningKeys() {
      return fail(
        500,
        "QSTASH_SIGNING_KEYS_MISSING",
        "QStash signing keys are required to receive reminder webhooks.",
      );
    };
