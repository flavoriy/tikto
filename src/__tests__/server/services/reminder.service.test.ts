import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ReminderStatus,
  ReminderTargetType,
  SyncStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

import { createReminderService } from "@/server/services/reminder.service";

const fixedNow = new Date("2026-05-17T08:00:00.000Z");

type TaskFixture = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  dueAtUtc: Date | null;
  completedAt: Date | null;
  googleTaskId: string | null;
  googleTasklistId: string | null;
  googleEtag: string | null;
  googleUpdatedAt: Date | null;
  syncStatus: SyncStatus;
  lastSyncDirection: "APP_TO_GOOGLE" | "GOOGLE_TO_APP" | null;
  lastSyncedAt: Date | null;
  syncError: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeTask(overrides: Partial<TaskFixture> = {}): TaskFixture {
  return {
    id: "task-1",
    userId: "user-1",
    title: "Submit project report",
    description: "Send the final PDF",
    status: "TODO",
    priority: "HIGH",
    dueDate: "2026-05-18",
    dueTime: "15:00",
    dueAtUtc: new Date("2026-05-18T08:00:00.000Z"),
    completedAt: null,
    googleTaskId: null,
    googleTasklistId: null,
    googleEtag: null,
    googleUpdatedAt: null,
    syncStatus: "LOCAL_ONLY",
    lastSyncDirection: null,
    lastSyncedAt: null,
    syncError: null,
    deletedAt: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides,
  };
}

type EventFixture = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  color: string | null;
  isAllDay: boolean;
  startAtUtc: Date | null;
  endAtUtc: Date | null;
  startDate: string | null;
  endDate: string | null;
  googleEventId: string | null;
  googleCalendarId: string | null;
  googleEtag: string | null;
  googleUpdatedAt: Date | null;
  syncStatus: SyncStatus;
  lastSyncDirection: "APP_TO_GOOGLE" | "GOOGLE_TO_APP" | null;
  lastSyncedAt: Date | null;
  syncError: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeEvent(overrides: Partial<EventFixture> = {}): EventFixture {
  return {
    id: "event-1",
    userId: "user-1",
    title: "Design review",
    description: "Review the latest mockups",
    color: "teal",
    isAllDay: false,
    startAtUtc: new Date("2026-05-18T09:00:00.000Z"),
    endAtUtc: new Date("2026-05-18T10:00:00.000Z"),
    startDate: null,
    endDate: null,
    googleEventId: null,
    googleCalendarId: null,
    googleEtag: null,
    googleUpdatedAt: null,
    syncStatus: "LOCAL_ONLY",
    lastSyncDirection: null,
    lastSyncedAt: null,
    syncError: null,
    deletedAt: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides,
  };
}

type ReminderFixture = {
  id: string;
  userId: string;
  targetType: ReminderTargetType;
  targetId: string;
  offsetMinutes: number;
  remindAtUtc: Date;
  channel: "TELEGRAM";
  status: ReminderStatus;
  externalJobId: string | null;
  deliveryAttemptCount: number;
  lastError: string | null;
  sentAt: Date | null;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeReminder(overrides: Partial<ReminderFixture> = {}): ReminderFixture {
  return {
    id: "reminder-1",
    userId: "user-1",
    targetType: "TASK",
    targetId: "task-1",
    offsetMinutes: 15,
    remindAtUtc: new Date("2026-05-18T07:45:00.000Z"),
    channel: "TELEGRAM",
    status: "SCHEDULED",
    externalJobId: null,
    deliveryAttemptCount: 0,
    lastError: null,
    sentAt: null,
    canceledAt: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides,
  };
}

function makeTelegramIntegration(
  overrides: {
    botTokenEncrypted?: string | null;
    chatId?: string | null;
    isEnabled?: boolean;
  } = {},
) {
  return {
    botTokenEncrypted: "encrypted-telegram-token",
    chatId: "chat-1",
    isEnabled: true,
    ...overrides,
  };
}

function createDeps() {
  return {
    reminderRepository: {
      findById: vi.fn(),
      listPendingByTarget: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    profileRepository: {
      findById: vi.fn(),
    },
    taskRepository: {
      findById: vi.fn(),
    },
    eventRepository: {
      findById: vi.fn(),
    },
    telegramIntegrationRepository: {
      findByUserId: vi.fn(),
    },
    scheduler: {
      scheduleReminderDelivery: vi.fn(),
      cancelReminderDelivery: vi.fn(),
    },
    sendTelegramMessage: vi.fn(),
    decryptToken: vi.fn(() => "telegram-token"),
    now: vi.fn(() => fixedNow),
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
    },
  };
}

describe("reminder.service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.QSTASH_TOKEN = "qstash-token";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.QSTASH_CURRENT_SIGNING_KEY = "current-signing-key";
    process.env.QSTASH_NEXT_SIGNING_KEY = "next-signing-key";
  });

  it("schedules task reminders from profile defaults", async () => {
    const deps = createDeps();
    const service = createReminderService(deps);

    deps.reminderRepository.listPendingByTarget.mockResolvedValue([]);
    deps.profileRepository.findById.mockResolvedValue({
      defaultTaskReminderOffsetsMinutes: [60, 15],
    });
    deps.telegramIntegrationRepository.findByUserId.mockResolvedValue(makeTelegramIntegration());
    deps.reminderRepository.create
      .mockResolvedValueOnce(makeReminder({ id: "reminder-15", offsetMinutes: 15 }))
      .mockResolvedValueOnce(makeReminder({ id: "reminder-60", offsetMinutes: 60 }));
    deps.scheduler.scheduleReminderDelivery
      .mockResolvedValueOnce({ messageId: "job-15" })
      .mockResolvedValueOnce({ messageId: "job-60" });

    const result = await service.syncTaskReminders({
      userId: "user-1",
      task: makeTask(),
    });

    expect(result).toEqual({ created: 2, canceled: 0 });
    expect(deps.reminderRepository.create).toHaveBeenCalledTimes(2);
    expect(deps.scheduler.scheduleReminderDelivery).toHaveBeenCalledTimes(2);
    expect(deps.reminderRepository.update).toHaveBeenCalledWith("reminder-15", {
      externalJobId: "job-15",
    });
    expect(deps.reminderRepository.update).toHaveBeenCalledWith("reminder-60", {
      externalJobId: "job-60",
    });
  });

  it("cancels pending task reminders when the task is no longer schedulable", async () => {
    const deps = createDeps();
    const service = createReminderService(deps);
    const pendingReminder = makeReminder({ id: "pending-reminder", externalJobId: "job-1" });

    deps.reminderRepository.listPendingByTarget.mockResolvedValue([pendingReminder]);

    const result = await service.syncTaskReminders({
      userId: "user-1",
      task: makeTask({ status: "DONE" }),
    });

    expect(result).toEqual({ created: 0, canceled: 1, skippedReason: "UNSCHEDULABLE_TASK" });
    expect(deps.scheduler.cancelReminderDelivery).toHaveBeenCalledWith("job-1");
    expect(deps.reminderRepository.update).toHaveBeenCalledWith("pending-reminder", {
      status: "CANCELED",
      canceledAt: fixedNow,
      lastError: null,
    });
  });

  it("does not schedule reminders when delivery infrastructure is missing", async () => {
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    const deps = createDeps();
    const service = createReminderService(deps);

    deps.reminderRepository.listPendingByTarget.mockResolvedValue([]);
    deps.profileRepository.findById.mockResolvedValue({
      defaultTaskReminderOffsetsMinutes: [15],
    });
    deps.telegramIntegrationRepository.findByUserId.mockResolvedValue(makeTelegramIntegration());

    const result = await service.syncTaskReminders({
      userId: "user-1",
      task: makeTask(),
    });

    expect(result).toEqual({ created: 0, canceled: 0, skippedReason: "DELIVERY_NOT_READY" });
    expect(deps.reminderRepository.create).not.toHaveBeenCalled();
    expect(deps.scheduler.scheduleReminderDelivery).not.toHaveBeenCalled();
  });

  it("delivers a task reminder through Telegram and marks it sent", async () => {
    const deps = createDeps();
    const service = createReminderService(deps);
    const reminder = makeReminder();

    deps.reminderRepository.findById.mockResolvedValue(reminder);
    deps.profileRepository.findById.mockResolvedValue({ timezone: "Asia/Ho_Chi_Minh" });
    deps.telegramIntegrationRepository.findByUserId.mockResolvedValue(makeTelegramIntegration());
    deps.taskRepository.findById.mockResolvedValue(makeTask());
    deps.sendTelegramMessage.mockResolvedValue({
      messageId: 77,
      chatId: "chat-1",
      sentAt: fixedNow,
    });

    const result = await service.deliverReminder("reminder-1");

    expect(result).toEqual({
      status: "sent",
      reminderId: "reminder-1",
      messageId: 77,
    });
    expect(deps.sendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "telegram-token",
        chatId: "chat-1",
      }),
    );
    expect(deps.sendTelegramMessage.mock.calls[0]?.[0].text).toContain("Task reminder");
    expect(deps.reminderRepository.update).toHaveBeenCalledWith("reminder-1", {
      status: "SENT",
      sentAt: fixedNow,
      deliveryAttemptCount: 1,
      lastError: null,
    });
  });

  it("cancels delivery when the target item is no longer eligible", async () => {
    const deps = createDeps();
    const service = createReminderService(deps);
    const reminder = makeReminder();

    deps.reminderRepository.findById.mockResolvedValue(reminder);
    deps.profileRepository.findById.mockResolvedValue({ timezone: "Asia/Ho_Chi_Minh" });
    deps.telegramIntegrationRepository.findByUserId.mockResolvedValue(makeTelegramIntegration());
    deps.taskRepository.findById.mockResolvedValue(makeTask({ deletedAt: fixedNow }));

    const result = await service.deliverReminder("reminder-1");

    expect(result).toEqual({ status: "canceled" });
    expect(deps.sendTelegramMessage).not.toHaveBeenCalled();
    expect(deps.reminderRepository.update).toHaveBeenCalledWith("reminder-1", {
      status: "CANCELED",
      canceledAt: fixedNow,
      lastError: "Task is no longer eligible for reminders.",
    });
  });

  it("marks the reminder failed and rethrows when Telegram delivery fails", async () => {
    const deps = createDeps();
    const service = createReminderService(deps);
    const reminder = makeReminder({ deliveryAttemptCount: 2, targetType: "EVENT", targetId: "event-1" });

    deps.reminderRepository.findById.mockResolvedValue(reminder);
    deps.profileRepository.findById.mockResolvedValue({ timezone: "Asia/Ho_Chi_Minh" });
    deps.telegramIntegrationRepository.findByUserId.mockResolvedValue(makeTelegramIntegration());
    deps.eventRepository.findById.mockResolvedValue(makeEvent());
    deps.sendTelegramMessage.mockRejectedValue(new Error("Telegram send failed"));

    await expect(service.deliverReminder("reminder-1")).rejects.toThrow("Telegram send failed");

    expect(deps.reminderRepository.update).toHaveBeenCalledWith("reminder-1", {
      status: "FAILED",
      deliveryAttemptCount: 3,
      lastError: "Telegram send failed",
    });
  });
});
