import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncStatus, TaskPriority, TaskStatus } from "@prisma/client";

vi.mock("@/server/repositories/task.repository", () => ({
  taskRepository: {
    listByUser: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/server/services/google-sync.service", () => ({
  syncTaskToGoogle: vi.fn(),
}));

vi.mock("@/server/services/reminder.service", () => ({
  syncTaskReminders: vi.fn(),
}));

import { taskRepository } from "@/server/repositories/task.repository";
import { syncTaskToGoogle } from "@/server/services/google-sync.service";
import { syncTaskReminders } from "@/server/services/reminder.service";
import { completeTask, createTask, updateTask } from "@/server/services/task.service";

const mockTaskRepository = vi.mocked(taskRepository);
const mockSyncTaskToGoogle = vi.mocked(syncTaskToGoogle);
const mockSyncTaskReminders = vi.mocked(syncTaskReminders);

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
    title: "Write release notes",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: "2026-05-18",
    dueTime: "09:30",
    dueAtUtc: new Date("2026-05-18T02:30:00.000Z"),
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
    createdAt: new Date("2026-05-17T08:00:00.000Z"),
    updatedAt: new Date("2026-05-17T08:00:00.000Z"),
    ...overrides,
  };
}

describe("task.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a task and schedules reminders with parsed reminder offsets", async () => {
    const task = makeTask();
    mockTaskRepository.create.mockResolvedValue(task);
    mockSyncTaskReminders.mockResolvedValue({
      created: 1,
      canceled: 0,
    });

    const result = await createTask({
      userId: "user-1",
      timezone: "Asia/Ho_Chi_Minh",
      payload: {
        title: "Write release notes",
        dueDate: "2026-05-18",
        dueTime: "09:30",
        reminderOffsetsMinutes: [15],
      },
    });

    expect(result).toBe(task);
    expect(mockTaskRepository.create).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        title: "Write release notes",
        dueDate: "2026-05-18",
        dueTime: "09:30",
        dueAtUtc: expect.any(Date),
      }),
    );
    expect(mockSyncTaskReminders).toHaveBeenCalledWith({
      userId: "user-1",
      task,
      reminderOffsetsMinutes: [15],
    });
    expect(mockSyncTaskToGoogle).toHaveBeenCalledWith("user-1", "task-1");
  });

  it("passes reminder offsets through on update", async () => {
    const existing = makeTask({ googleTaskId: "google-1", syncStatus: "SYNCED" });
    const updated = makeTask({ title: "Updated title", syncStatus: "PENDING_UPDATE" });
    mockTaskRepository.findById.mockResolvedValue(existing);
    mockTaskRepository.update.mockResolvedValue(updated);
    mockSyncTaskReminders.mockResolvedValue({
      created: 2,
      canceled: 1,
    });

    const result = await updateTask({
      userId: "user-1",
      id: "task-1",
      timezone: "Asia/Ho_Chi_Minh",
      payload: {
        title: "Updated title",
        dueDate: "2026-05-18",
        dueTime: "09:30",
        reminderOffsetsMinutes: [15, 60],
      },
    });

    expect(result).toBe(updated);
    expect(mockTaskRepository.update).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        title: "Updated title",
        syncStatus: "PENDING_UPDATE",
      }),
    );
    expect(mockSyncTaskReminders).toHaveBeenCalledWith({
      userId: "user-1",
      task: updated,
      reminderOffsetsMinutes: [15, 60],
    });
    expect(mockSyncTaskToGoogle).toHaveBeenCalledWith("user-1", "task-1");
  });

  it("cancels reminders when completing a task", async () => {
    const existing = makeTask({ googleTaskId: "google-1", syncStatus: "SYNCED" });
    const completed = makeTask({
      status: "DONE",
      completedAt: new Date("2026-05-17T10:00:00.000Z"),
      syncStatus: "PENDING_UPDATE",
    });
    mockTaskRepository.findById.mockResolvedValue(existing);
    mockTaskRepository.update.mockResolvedValue(completed);
    mockSyncTaskReminders.mockResolvedValue({
      created: 0,
      canceled: 1,
    });

    const result = await completeTask("user-1", "task-1");

    expect(result).toBe(completed);
    expect(mockSyncTaskReminders).toHaveBeenCalledWith({
      userId: "user-1",
      task: completed,
    });
    expect(mockSyncTaskToGoogle).toHaveBeenCalledWith("user-1", "task-1");
  });
});
