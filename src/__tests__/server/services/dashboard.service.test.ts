import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/repositories/task.repository", () => ({
  taskRepository: {
    listByUser: vi.fn(),
  },
}));

vi.mock("@/server/repositories/event.repository", () => ({
  eventRepository: {
    listByUser: vi.fn(),
  },
}));

import { eventRepository } from "@/server/repositories/event.repository";
import { taskRepository } from "@/server/repositories/task.repository";
import { getDashboardData } from "@/server/services/dashboard.service";

const mockTaskRepository = vi.mocked(taskRepository);
const mockEventRepository = vi.mocked(eventRepository);

describe("dashboard.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T03:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds dashboard lists and summary from tasks and events", async () => {
    mockTaskRepository.listByUser.mockResolvedValue([
      {
        id: "task-today",
        userId: "user-1",
        title: "Prepare demo",
        description: null,
        status: "TODO",
        priority: "HIGH",
        dueDate: "2026-05-17",
        dueTime: null,
        dueAtUtc: null,
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
        createdAt: new Date("2026-05-17T00:00:00.000Z"),
        updatedAt: new Date("2026-05-17T00:00:00.000Z"),
      },
      {
        id: "task-overdue",
        userId: "user-1",
        title: "Fix bug",
        description: null,
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        dueDate: "2026-05-16",
        dueTime: "11:00",
        dueAtUtc: new Date("2026-05-16T04:00:00.000Z"),
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
        createdAt: new Date("2026-05-16T00:00:00.000Z"),
        updatedAt: new Date("2026-05-16T00:00:00.000Z"),
      },
      {
        id: "task-done",
        userId: "user-1",
        title: "Close invoice",
        description: null,
        status: "DONE",
        priority: "LOW",
        dueDate: "2026-05-15",
        dueTime: null,
        dueAtUtc: null,
        completedAt: new Date("2026-05-15T10:00:00.000Z"),
        googleTaskId: null,
        googleTasklistId: null,
        googleEtag: null,
        googleUpdatedAt: null,
        syncStatus: "LOCAL_ONLY",
        lastSyncDirection: null,
        lastSyncedAt: null,
        syncError: null,
        deletedAt: null,
        createdAt: new Date("2026-05-15T00:00:00.000Z"),
        updatedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
    ]);

    mockEventRepository.listByUser.mockResolvedValue([
      {
        id: "event-today",
        userId: "user-1",
        title: "Sprint review",
        description: null,
        color: null,
        isAllDay: false,
        startAtUtc: new Date("2026-05-17T06:00:00.000Z"),
        endAtUtc: new Date("2026-05-17T07:00:00.000Z"),
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
        createdAt: new Date("2026-05-17T00:00:00.000Z"),
        updatedAt: new Date("2026-05-17T00:00:00.000Z"),
      },
    ]);

    const result = await getDashboardData("user-1", "Asia/Ho_Chi_Minh");

    expect(result.summary).toEqual({
      dueToday: 1,
      eventsToday: 1,
      overdueTasks: 1,
      completedThisWeek: 1,
    });
    expect(result.todayTasks.map((task) => task.id)).toEqual(["task-today"]);
    expect(result.overdueTasks.map((task) => task.id)).toEqual(["task-overdue"]);
    expect(result.todayEvents.map((event) => event.id)).toEqual(["event-today"]);
  });
});
