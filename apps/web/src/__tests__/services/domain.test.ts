import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../../../packages/service-runtime/src/errors";
import type { RequestContext } from "../../../../../packages/service-runtime/src/http";
import { createCalendarDomain } from "../../../../../services/calendar/src/domain";
import { createDashboardDomain } from "../../../../../services/dashboard/src/domain";
import { createProfileDomain } from "../../../../../services/profile/src/domain";
import { createProfileRepository } from "../../../../../services/profile/src/repository";
import { createTasksDomain } from "../../../../../services/tasks/src/domain";

const context: RequestContext = {
  userId: "user-1",
  timezone: "UTC",
  email: "person@example.com",
  name: "Person Demo",
  avatarUrl: "https://example.test/avatar.png",
};
const now = new Date("2026-01-15T10:00:00.000Z");

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    userId: context.userId,
    title: "Alpha task",
    description: "Write tests",
    status: "TODO",
    priority: "HIGH",
    dueDate: "2026-01-15",
    dueTime: "13:00",
    dueAtUtc: new Date("2026-01-15T13:00:00.000Z"),
    completedAt: null,
    deletedAt: null,
    googleTaskId: null,
    syncStatus: "SYNCED",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    userId: context.userId,
    title: "Planning",
    description: null,
    color: "teal",
    isAllDay: false,
    startAtUtc: new Date("2026-01-15T09:00:00.000Z"),
    endAtUtc: new Date("2026-01-15T10:00:00.000Z"),
    startDate: null,
    endDate: null,
    deletedAt: null,
    googleEventId: null,
    syncStatus: "SYNCED",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.TIKTO_TASKS_API_URL;
  delete process.env.TIKTO_CALENDAR_API_URL;
  delete process.env.TIKTO_INTERNAL_API_KEY;
});

describe("profile domain", () => {
  it("creates a profile from auth context when none exists", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn(async (data) => ({
        ...data,
        defaultTaskReminderOffsetsMinutes: [],
        defaultEventReminderOffsetsMinutes: [],
        createdAt: now,
        updatedAt: now,
      })),
      update: vi.fn(),
    };
    const domain = createProfileDomain(repository as never);

    await expect(domain.getOrCreateProfile(context)).resolves.toMatchObject({
      id: context.userId,
      email: context.email,
      name: context.name,
      timezone: "Asia/Ho_Chi_Minh",
    });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ id: context.userId }));
  });

  it("falls back to a second lookup when create races", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const repository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: context.userId,
          email: context.email,
          name: "Existing",
          avatarUrl: null,
          timezone: "UTC",
          defaultTaskReminderOffsetsMinutes: [10],
          defaultEventReminderOffsetsMinutes: [15],
          createdAt: now,
          updatedAt: now,
        }),
      create: vi.fn().mockRejectedValue(new Error("duplicate key")),
      update: vi.fn(),
    };
    const domain = createProfileDomain(repository as never);

    await expect(domain.getOrCreateProfile(context)).resolves.toMatchObject({
      name: "Existing",
      defaultTaskReminderOffsetsMinutes: [10],
    });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("returns existing profile when present", async () => {
    const existingProfile = {
      id: context.userId,
      email: "existing@example.com",
      name: "Existing Person",
      avatarUrl: "https://example.test/pic.png",
      timezone: "Asia/Ho_Chi_Minh",
      defaultTaskReminderOffsetsMinutes: [10],
      defaultEventReminderOffsetsMinutes: [20],
      createdAt: now,
      updatedAt: now,
    };
    const repository = {
      findById: vi.fn().mockResolvedValue(existingProfile),
      create: vi.fn(),
      update: vi.fn(),
    };
    const domain = createProfileDomain(repository as never);

    await expect(domain.getOrCreateProfile(context)).resolves.toMatchObject({
      id: context.userId,
      name: "Existing Person",
      defaultTaskReminderOffsetsMinutes: [10],
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("handles fallback name parsing from email and null name update", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn(async (data) => ({
        ...data,
        defaultTaskReminderOffsetsMinutes: [],
        defaultEventReminderOffsetsMinutes: [],
        createdAt: now,
        updatedAt: now,
      })),
      update: vi.fn(async (_id, data) => ({
        id: "u-2",
        email: "alice@domain.com",
        name: data.name ?? null,
        avatarUrl: null,
        timezone: data.timezone,
        defaultTaskReminderOffsetsMinutes: [],
        defaultEventReminderOffsetsMinutes: [],
        createdAt: now,
        updatedAt: now,
      })),
    };
    const domain = createProfileDomain(repository as never);

    const created = await domain.getOrCreateProfile({
      userId: "u-2",
      timezone: "UTC",
      email: "alice@domain.com",
    });
    expect(created).toMatchObject({ name: "alice" });

    const createdAnonymous = await domain.getOrCreateProfile({
      userId: "u-3",
      timezone: "UTC",
    });
    expect(createdAnonymous).toMatchObject({ name: "User" });

    const updated = await domain.updateProfile(context, {
      timezone: "UTC",
    });
    expect(updated).toMatchObject({ name: null });
  });

  it("delegates to prisma client in profile repository", async () => {
    const prisma = {
      profile: {
        findUnique: vi.fn().mockResolvedValue({ id: "user-1" }),
        create: vi.fn().mockResolvedValue({ id: "user-1" }),
        update: vi.fn().mockResolvedValue({ id: "user-1" }),
      },
    };
    const repo = createProfileRepository(prisma as never);
    await repo.findById("user-1");
    await repo.create({ id: "user-1", email: "test@example.com", timezone: "UTC" });
    await repo.update("user-1", { name: "New" });

    expect(prisma.profile.findUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(prisma.profile.create).toHaveBeenCalledWith({ data: { id: "user-1", email: "test@example.com", timezone: "UTC" } });
    expect(prisma.profile.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { name: "New" } });
  });
});

describe("tasks domain", () => {
  it("filters, sorts, and serializes task lists", async () => {
    const repository = {
      listByUser: vi.fn().mockResolvedValue([
        task({ id: "task-2", title: "Beta", status: "DONE", priority: "LOW", completedAt: now }),
        task({ id: "task-1", title: "Alpha task", status: "TODO", priority: "HIGH" }),
      ]),
      findByUserAndId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    const domain = createTasksDomain(repository as never);

    await expect(domain.listTasksForView(context, {
      view: "all",
      status: "TODO",
      priority: "HIGH",
      search: "alpha",
    })).resolves.toMatchObject({
      filters: {
        view: "all",
        status: "TODO",
        priority: "HIGH",
        search: "alpha",
      },
      tasks: [
        {
          id: "task-1",
          title: "Alpha task",
        },
      ],
    });
  });

  it("creates tasks with local due date converted to UTC", async () => {
    const repository = {
      listByUser: vi.fn(),
      findByUserAndId: vi.fn(),
      create: vi.fn(async (data) => task({ ...data, id: "created" })),
      update: vi.fn(),
    };
    const domain = createTasksDomain(repository as never);

    const created = await domain.createTask(context, {
      title: "Ship refactor",
      description: "",
      priority: "MEDIUM",
      status: "TODO",
      dueDate: "2026-01-16",
      dueTime: "09:30",
    });

    expect(created).toMatchObject({ id: "created", title: "Ship refactor" });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: context.userId,
      dueAtUtc: new Date("2026-01-16T09:30:00.000Z"),
    }));
  });

  it("updates completion state and sync status for Google-linked tasks", async () => {
    const existing = task({ googleTaskId: "google-task-1" });
    const repository = {
      listByUser: vi.fn(),
      findByUserAndId: vi.fn().mockResolvedValue(existing),
      create: vi.fn(),
      update: vi.fn(async (_id, data) => task({ ...existing, ...data })),
    };
    const domain = createTasksDomain(repository as never);

    await expect(domain.completeTask(context, "task-1")).resolves.toMatchObject({ status: "DONE" });
    expect(repository.update).toHaveBeenLastCalledWith("task-1", expect.objectContaining({
      status: "DONE",
      syncStatus: "PENDING_UPDATE",
    }));

    await expect(domain.reopenTask(context, "task-1")).resolves.toMatchObject({ status: "TODO" });
    await domain.deleteTask(context, "task-1");
    expect(repository.update).toHaveBeenLastCalledWith("task-1", expect.objectContaining({
      syncStatus: "PENDING_DELETE",
    }));
  });

  it("rejects missing or deleted tasks", async () => {
    const repository = {
      listByUser: vi.fn(),
      findByUserAndId: vi.fn().mockResolvedValue(task({ deletedAt: now })),
      create: vi.fn(),
      update: vi.fn(),
    };
    const domain = createTasksDomain(repository as never);

    await expect(domain.updateTask(context, "task-1", { title: "x" })).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });
});

describe("calendar domain", () => {
  it("lists events by range and returns calendar view data", async () => {
    const matching = event({ id: "event-1", startDate: "2026-01-15", endDate: "2026-01-15", isAllDay: true, startAtUtc: null, endAtUtc: null });
    const outside = event({ id: "event-2", startAtUtc: new Date("2026-02-10T09:00:00.000Z"), endAtUtc: new Date("2026-02-10T10:00:00.000Z") });
    const repository = {
      listByUser: vi.fn().mockResolvedValue([outside, matching]),
      findByUserAndId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    const domain = createCalendarDomain(repository as never);

    await expect(domain.listEventsInRange(context, { from: "2026-01-15", to: "2026-01-15" })).resolves.toEqual([
      expect.objectContaining({ id: "event-1" }),
    ]);
    await expect(domain.getCalendarData(context, { view: "day", date: "2026-01-15" })).resolves.toMatchObject({
      anchorDate: "2026-01-15",
      view: "day",
      events: [expect.objectContaining({ id: "event-1" })],
    });
  });

  it("creates all-day and timed events", async () => {
    const repository = {
      listByUser: vi.fn(),
      findByUserAndId: vi.fn(),
      create: vi.fn(async (data) => event({ ...data, id: "created" })),
      update: vi.fn(),
    };
    const domain = createCalendarDomain(repository as never);

    await expect(domain.createEvent(context, {
      title: "All day",
      isAllDay: true,
      startDate: "2026-01-20",
      endDate: "2026-01-20",
    })).resolves.toMatchObject({
      id: "created",
      isAllDay: true,
      startDate: "2026-01-20",
    });

    await expect(domain.createEvent(context, {
      title: "Timed",
      isAllDay: false,
      startLocal: "2026-01-20T09:00",
      endLocal: "2026-01-20T10:00",
    })).resolves.toMatchObject({
      id: "created",
      isAllDay: false,
      startAtUtc: "2026-01-20T09:00:00.000Z",
    });
  });

  it("rejects invalid timed ranges and deleted events", async () => {
    const repository = {
      listByUser: vi.fn(),
      findByUserAndId: vi.fn().mockResolvedValue(event({ deletedAt: now })),
      create: vi.fn(),
      update: vi.fn(),
    };
    const domain = createCalendarDomain(repository as never);

    await expect(domain.createEvent(context, {
      title: "Bad",
      isAllDay: false,
      startLocal: "2026-01-20T10:00",
      endLocal: "2026-01-20T09:00",
    })).rejects.toBeInstanceOf(AppError);
    await expect(domain.updateEvent(context, "event-1", {
      title: "Update",
      isAllDay: true,
      startDate: "2026-01-20",
      endDate: "2026-01-20",
    })).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
  });

  it("marks Google-linked events for sync when updating and deleting", async () => {
    const existing = event({ googleEventId: "google-event-1" });
    const repository = {
      listByUser: vi.fn(),
      findByUserAndId: vi.fn().mockResolvedValue(existing),
      create: vi.fn(),
      update: vi.fn(async (_id, data) => event({ ...existing, ...data })),
    };
    const domain = createCalendarDomain(repository as never);

    await domain.updateEvent(context, "event-1", {
      title: "Updated",
      isAllDay: true,
      startDate: "2026-01-21",
      endDate: "2026-01-21",
    });
    expect(repository.update).toHaveBeenLastCalledWith("event-1", expect.objectContaining({
      syncStatus: "PENDING_UPDATE",
    }));

    await domain.deleteEvent(context, "event-1");
    expect(repository.update).toHaveBeenLastCalledWith("event-1", expect.objectContaining({
      syncStatus: "PENDING_DELETE",
    }));
  });
});

describe("dashboard domain", () => {
  it("composes task and calendar summaries from internal services", async () => {
    process.env.TIKTO_TASKS_API_URL = "https://tasks.internal///";
    process.env.TIKTO_CALENDAR_API_URL = "https://calendar.internal";
    process.env.TIKTO_INTERNAL_API_KEY = "internal-secret";
    const completedAt = new Date().toISOString();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = init?.headers as Headers;
      expect(headers.get("x-tikto-user-id")).toBe(context.userId);
      expect(headers.get("x-tikto-internal-key")).toBe("internal-secret");

      if (url.includes("view=overdue")) {
        return Response.json({ success: true, data: { filters: {}, tasks: [task({ id: "overdue" })] } });
      }

      if (url.includes("view=completed")) {
        return Response.json({ success: true, data: { filters: {}, tasks: [task({ id: "done", completedAt })] } });
      }

      if (url.includes("/events?")) {
        return Response.json({ success: true, data: { events: [event()] } });
      }

      return Response.json({ success: true, data: { filters: {}, tasks: [task({ id: "today" })] } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const domain = createDashboardDomain();

    await expect(domain.getDashboardData(context)).resolves.toMatchObject({
      todayTasks: [expect.objectContaining({ id: "today" })],
      overdueTasks: [expect.objectContaining({ id: "overdue" })],
      todayEvents: [expect.objectContaining({ id: "event-1" })],
      summary: {
        dueToday: 1,
        eventsToday: 1,
        overdueTasks: 1,
        completedThisWeek: 1,
      },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://tasks.internal/tasks?view=today");
  });

  it("raises dependency errors from failed service envelopes", async () => {
    process.env.TIKTO_TASKS_API_URL = "https://tasks.internal";
    process.env.TIKTO_CALENDAR_API_URL = "https://calendar.internal";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      success: false,
      error: {
        code: "DOWNSTREAM",
        message: "failed",
      },
    }, { status: 503 })));

    await expect(createDashboardDomain().getDashboardData(context)).rejects.toMatchObject({
      code: "DOWNSTREAM",
      status: 503,
    });
  });
});
