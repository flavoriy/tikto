import "server-only";

import type { Event, Profile, Reminder, Task, TelegramIntegration } from "@prisma/client";

import { toLocalDateTimeLabel } from "@/lib/dates/taskflow-dates";
import { decrypt } from "@/lib/google/crypto";
import { sendTelegramMessage } from "@/lib/telegram/bot";
import { qstashReminderScheduler, type ReminderScheduler } from "@/lib/qstash/client";
import { reminderRepository } from "@/server/repositories/reminder.repository";
import { profileRepository } from "@/server/repositories/profile.repository";
import { taskRepository } from "@/server/repositories/task.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { telegramIntegrationRepository } from "@/server/repositories/telegram-integration.repository";

type TaskRecord = Task;
type EventRecord = Event;
type ReminderRecord = Reminder;

type ReminderSyncResult = {
  created: number;
  canceled: number;
  skippedReason?: string;
};

type ReminderDeliveryResult =
  | { status: "ignored" | "canceled" }
  | { status: "sent"; reminderId: string; messageId: number };

type ReminderServiceDeps = {
  reminderRepository: {
    findById(id: string): Promise<Reminder | null>;
    listPendingByTarget(userId: string, targetType: "TASK" | "EVENT", targetId: string, now?: Date): Promise<Reminder[]>;
    create(userId: string, data: {
      targetType: "TASK" | "EVENT";
      targetId: string;
      offsetMinutes: number;
      remindAtUtc: Date;
      channel: "TELEGRAM";
      status: "SCHEDULED";
    }): Promise<Reminder>;
    update(id: string, data: Record<string, unknown>): Promise<Reminder>;
  };
  profileRepository: {
    findById(id: string): Promise<Profile | null>;
  };
  taskRepository: {
    findById(userId: string, id: string): Promise<Task | null>;
  };
  eventRepository: {
    findById(userId: string, id: string): Promise<Event | null>;
  };
  telegramIntegrationRepository: {
    findByUserId(userId: string): Promise<TelegramIntegration | null>;
  };
  scheduler: ReminderScheduler;
  sendTelegramMessage: typeof sendTelegramMessage;
  decryptToken: typeof decrypt;
  now: () => Date;
  logger: Pick<Console, "error" | "warn">;
};

type TaskReminderSyncInput = {
  userId: string;
  task: TaskRecord;
  reminderOffsetsMinutes?: number[] | undefined;
};

type EventReminderSyncInput = {
  userId: string;
  event: EventRecord;
  reminderOffsetsMinutes?: number[] | undefined;
};

const defaultDeps: ReminderServiceDeps = {
  reminderRepository,
  profileRepository,
  taskRepository,
  eventRepository,
  telegramIntegrationRepository,
  scheduler: qstashReminderScheduler,
  sendTelegramMessage,
  decryptToken: decrypt,
  now: () => new Date(),
  logger: console,
};

function normalizeReminderOffsets(offsets: number[] | null | undefined) {
  return [...new Set((offsets ?? []).filter((value) => Number.isInteger(value) && value > 0))].sort(
    (left, right) => left - right,
  );
}

function priorityLabel(priority: TaskRecord["priority"]) {
  if (priority === "HIGH") return "High";
  if (priority === "LOW") return "Low";
  return "Medium";
}

function buildTaskReminderMessage(task: TaskRecord, timezone: string) {
  const lines = [
    "Task reminder",
    "",
    task.title,
    task.dueAtUtc ? `Due: ${toLocalDateTimeLabel(task.dueAtUtc, timezone)}` : "Due: Time TBD",
    `Priority: ${priorityLabel(task.priority)}`,
  ];

  if (task.description) {
    lines.push("", task.description);
  }

  return lines.join("\n");
}

function buildEventReminderMessage(event: EventRecord, timezone: string) {
  const lines = [
    "Upcoming event",
    "",
    event.title,
    event.startAtUtc ? `Starts: ${toLocalDateTimeLabel(event.startAtUtc, timezone)}` : "Starts: Time TBD",
  ];

  if (event.description) {
    lines.push("", event.description);
  }

  return lines.join("\n");
}

function isTelegramReady(integration: TelegramIntegration | null) {
  return Boolean(integration?.isEnabled && integration.chatId && integration.botTokenEncrypted);
}

function isReminderInfrastructureReady() {
  return Boolean(
    process.env.QSTASH_TOKEN &&
      process.env.NEXT_PUBLIC_APP_URL &&
      process.env.QSTASH_CURRENT_SIGNING_KEY &&
      process.env.QSTASH_NEXT_SIGNING_KEY,
  );
}

async function cancelPendingReminders(
  deps: ReminderServiceDeps,
  reminders: Reminder[],
) {
  if (reminders.length === 0) {
    return 0;
  }

  const canceledAt = deps.now();

  await Promise.all(
    reminders.map(async (reminder) => {
      let lastError: string | null = null;

      if (reminder.externalJobId) {
        try {
          await deps.scheduler.cancelReminderDelivery(reminder.externalJobId);
        } catch (error) {
          lastError = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
          deps.logger.warn(`[reminder] cancel failed for ${reminder.id}: ${lastError}`);
        }
      }

      await deps.reminderRepository.update(reminder.id, {
        status: "CANCELED",
        canceledAt,
        lastError,
      });
    }),
  );

  return reminders.length;
}

export function createReminderService(overrides: Partial<ReminderServiceDeps> = {}) {
  const deps: ReminderServiceDeps = { ...defaultDeps, ...overrides };
  const syncTaskReminders = async (input: TaskReminderSyncInput): Promise<ReminderSyncResult> => {
      const existing = await deps.reminderRepository.listPendingByTarget(
        input.userId,
        "TASK",
        input.task.id,
        deps.now(),
      );

      if (input.task.deletedAt || input.task.status === "DONE" || !input.task.dueAtUtc) {
        const canceled = await cancelPendingReminders(deps, existing);
        return { created: 0, canceled, skippedReason: "UNSCHEDULABLE_TASK" };
      }

      const profile = await deps.profileRepository.findById(input.userId);
      const offsets = normalizeReminderOffsets(
        input.reminderOffsetsMinutes ?? profile?.defaultTaskReminderOffsetsMinutes,
      );

      if (offsets.length === 0) {
        const canceled = await cancelPendingReminders(deps, existing);
        return { created: 0, canceled, skippedReason: "NO_OFFSETS" };
      }

      const integration = await deps.telegramIntegrationRepository.findByUserId(input.userId);
      if (!isTelegramReady(integration) || !isReminderInfrastructureReady()) {
        const canceled = await cancelPendingReminders(deps, existing);
        return { created: 0, canceled, skippedReason: "DELIVERY_NOT_READY" };
      }

      const canceled = await cancelPendingReminders(deps, existing);
      let created = 0;

      for (const offsetMinutes of offsets) {
        const remindAtUtc = new Date(input.task.dueAtUtc.getTime() - offsetMinutes * 60 * 1000);
        if (remindAtUtc <= deps.now()) {
          continue;
        }

        const reminder = await deps.reminderRepository.create(input.userId, {
          targetType: "TASK",
          targetId: input.task.id,
          offsetMinutes,
          remindAtUtc,
          channel: "TELEGRAM",
          status: "SCHEDULED",
        });

        created += 1;

        try {
          const job = await deps.scheduler.scheduleReminderDelivery(
            {
              reminderId: reminder.id,
              userId: input.userId,
              targetType: "TASK",
              targetId: input.task.id,
            },
            remindAtUtc,
          );

          await deps.reminderRepository.update(reminder.id, {
            externalJobId: job.messageId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          deps.logger.error(`[reminder] schedule failed for ${reminder.id}: ${message}`);
          await deps.reminderRepository.update(reminder.id, {
            status: "FAILED",
            lastError: message.slice(0, 500),
          });
        }
      }

      return { created, canceled };
  };

  const syncEventReminders = async (input: EventReminderSyncInput): Promise<ReminderSyncResult> => {
      const existing = await deps.reminderRepository.listPendingByTarget(
        input.userId,
        "EVENT",
        input.event.id,
        deps.now(),
      );

      if (input.event.deletedAt || input.event.isAllDay || !input.event.startAtUtc) {
        const canceled = await cancelPendingReminders(deps, existing);
        return { created: 0, canceled, skippedReason: "UNSCHEDULABLE_EVENT" };
      }

      const profile = await deps.profileRepository.findById(input.userId);
      const offsets = normalizeReminderOffsets(
        input.reminderOffsetsMinutes ?? profile?.defaultEventReminderOffsetsMinutes,
      );

      if (offsets.length === 0) {
        const canceled = await cancelPendingReminders(deps, existing);
        return { created: 0, canceled, skippedReason: "NO_OFFSETS" };
      }

      const integration = await deps.telegramIntegrationRepository.findByUserId(input.userId);
      if (!isTelegramReady(integration) || !isReminderInfrastructureReady()) {
        const canceled = await cancelPendingReminders(deps, existing);
        return { created: 0, canceled, skippedReason: "DELIVERY_NOT_READY" };
      }

      const canceled = await cancelPendingReminders(deps, existing);
      let created = 0;

      for (const offsetMinutes of offsets) {
        const remindAtUtc = new Date(input.event.startAtUtc.getTime() - offsetMinutes * 60 * 1000);
        if (remindAtUtc <= deps.now()) {
          continue;
        }

        const reminder = await deps.reminderRepository.create(input.userId, {
          targetType: "EVENT",
          targetId: input.event.id,
          offsetMinutes,
          remindAtUtc,
          channel: "TELEGRAM",
          status: "SCHEDULED",
        });

        created += 1;

        try {
          const job = await deps.scheduler.scheduleReminderDelivery(
            {
              reminderId: reminder.id,
              userId: input.userId,
              targetType: "EVENT",
              targetId: input.event.id,
            },
            remindAtUtc,
          );

          await deps.reminderRepository.update(reminder.id, {
            externalJobId: job.messageId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          deps.logger.error(`[reminder] schedule failed for ${reminder.id}: ${message}`);
          await deps.reminderRepository.update(reminder.id, {
            status: "FAILED",
            lastError: message.slice(0, 500),
          });
        }
      }

      return { created, canceled };
  };

  const deliverTaskReminder = async (
    reminder: ReminderRecord,
    chatId: string,
    botToken: string,
    timezone: string,
  ): Promise<ReminderDeliveryResult> => {
    const task = await deps.taskRepository.findById(reminder.userId, reminder.targetId);

    if (!task || task.deletedAt || task.status === "DONE" || !task.dueAtUtc) {
      await deps.reminderRepository.update(reminder.id, {
        status: "CANCELED",
        canceledAt: deps.now(),
        lastError: "Task is no longer eligible for reminders.",
      });
      return { status: "canceled" };
    }

    return deliverTelegramReminder({
      deps,
      reminder,
      chatId,
      botToken,
      text: buildTaskReminderMessage(task, timezone),
    });
  };

  const deliverEventReminder = async (
    reminder: ReminderRecord,
    chatId: string,
    botToken: string,
    timezone: string,
  ): Promise<ReminderDeliveryResult> => {
    const event = await deps.eventRepository.findById(reminder.userId, reminder.targetId);

    if (!event || event.deletedAt || event.isAllDay || !event.startAtUtc) {
      await deps.reminderRepository.update(reminder.id, {
        status: "CANCELED",
        canceledAt: deps.now(),
        lastError: "Event is no longer eligible for reminders.",
      });
      return { status: "canceled" };
    }

    return deliverTelegramReminder({
      deps,
      reminder,
      chatId,
      botToken,
      text: buildEventReminderMessage(event, timezone),
    });
  };

  const deliverReminder = async (reminderId: string): Promise<ReminderDeliveryResult> => {
      const reminder = await deps.reminderRepository.findById(reminderId);

      if (!reminder || reminder.status === "SENT" || reminder.status === "CANCELED") {
        return { status: "ignored" };
      }

      const profile = await deps.profileRepository.findById(reminder.userId);
      const timezone = profile?.timezone ?? "UTC";
      const integration = await deps.telegramIntegrationRepository.findByUserId(reminder.userId);

      if (!integration?.isEnabled || !integration.chatId || !integration.botTokenEncrypted) {
        await deps.reminderRepository.update(reminder.id, {
          status: "CANCELED",
          canceledAt: deps.now(),
          lastError: "Telegram integration is not enabled.",
        });
        return { status: "canceled" };
      }

      let botToken: string;

      try {
        botToken = deps.decryptToken(integration.botTokenEncrypted);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await deps.reminderRepository.update(reminder.id, {
          status: "FAILED",
          deliveryAttemptCount: reminder.deliveryAttemptCount + 1,
          lastError: message.slice(0, 500),
        });
        throw error;
      }

      if (reminder.targetType === "TASK") {
        return deliverTaskReminder(reminder, integration.chatId, botToken, timezone);
      }

      return deliverEventReminder(reminder, integration.chatId, botToken, timezone);
  };

  return {
    syncTaskReminders,
    syncEventReminders,
    deliverReminder,
    deliverTaskReminder,
    deliverEventReminder,
  };
}

async function deliverTelegramReminder(input: {
  deps: ReminderServiceDeps;
  reminder: ReminderRecord;
  chatId: string;
  botToken: string;
  text: string;
}): Promise<ReminderDeliveryResult> {
  try {
    const sent = await input.deps.sendTelegramMessage({
      token: input.botToken,
      chatId: input.chatId,
      text: input.text,
    });

    await input.deps.reminderRepository.update(input.reminder.id, {
      status: "SENT",
      sentAt: input.deps.now(),
      deliveryAttemptCount: input.reminder.deliveryAttemptCount + 1,
      lastError: null,
    });

    return {
      status: "sent",
      reminderId: input.reminder.id,
      messageId: sent.messageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await input.deps.reminderRepository.update(input.reminder.id, {
      status: "FAILED",
      deliveryAttemptCount: input.reminder.deliveryAttemptCount + 1,
      lastError: message.slice(0, 500),
    });

    throw error;
  }
}

const reminderService = createReminderService();

export const syncTaskReminders = reminderService.syncTaskReminders;
export const syncEventReminders = reminderService.syncEventReminders;
export const deliverReminder = reminderService.deliverReminder;
