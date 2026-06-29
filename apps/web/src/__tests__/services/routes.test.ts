import type { IncomingMessage } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../../../packages/service-runtime/src/errors";
import type { ServiceRoute } from "../../../../../packages/service-runtime/src/http";
import { createCalendarRoute } from "../../../../../services/calendar/src/route";
import { createTasksRoute } from "../../../../../services/tasks/src/route";

function request(body?: unknown) {
  const chunks = body === undefined ? [] : [JSON.stringify(body)];

  return {
    headers: {
      "x-tikto-user-id": "user-1",
      "x-tikto-user-timezone": "UTC",
    },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as unknown as IncomingMessage;
}

function routeInput(path: string, method: string, body?: unknown): Parameters<ServiceRoute>[0] {
  const url = new URL(`https://service.local${path}`);
  let pathname = url.pathname;

  while (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return {
    request: request(body),
    requestId: "request-1",
    url,
    pathname,
    segments: pathname.split("/").filter(Boolean),
    method,
  };
}

function healthyPrisma() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]),
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ exists: "public.table" }]),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DATABASE_URL;
  delete process.env.TIKTO_INTERNAL_API_KEY;
});

describe("tasks route", () => {
  it("routes health and collection requests", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@example.com:5432/app";
    const domain = {
      listTasksForView: vi.fn().mockResolvedValue({ tasks: [{ id: "task-1" }] }),
      createTask: vi.fn().mockResolvedValue({ id: "created" }),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      completeTask: vi.fn(),
      reopenTask: vi.fn(),
    };
    const route = createTasksRoute({ domain: domain as never, prisma: healthyPrisma() });

    await expect(route(routeInput("/health", "GET"))).resolves.toMatchObject({ status: 200 });
    await expect(route(routeInput("/tasks?view=today&status=TODO", "GET"))).resolves.toEqual({
      status: 200,
      data: { tasks: [{ id: "task-1" }] },
    });
    expect(domain.listTasksForView).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }), {
      view: "today",
      status: "TODO",
      priority: undefined,
      search: undefined,
    });

    await expect(route(routeInput("/tasks", "POST", { title: "New task" }))).resolves.toEqual({
      status: 201,
      data: { task: { id: "created" } },
    });
  });

  it("routes item and action requests", async () => {
    const domain = {
      listTasksForView: vi.fn(),
      createTask: vi.fn(),
      updateTask: vi.fn().mockResolvedValue({ id: "task 1", title: "Updated" }),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      completeTask: vi.fn().mockResolvedValue({ id: "task 1", status: "DONE" }),
      reopenTask: vi.fn().mockResolvedValue({ id: "task 1", status: "TODO" }),
    };
    const route = createTasksRoute({ domain: domain as never, prisma: healthyPrisma() });

    await expect(route(routeInput("/tasks/task%201", "PATCH", { title: "Updated" }))).resolves.toMatchObject({
      data: { task: { id: "task 1" } },
    });
    await expect(route(routeInput("/tasks/task%201", "DELETE"))).resolves.toEqual({
      status: 200,
      data: { deleted: true },
    });
    await expect(route(routeInput("/tasks/task%201/complete", "POST"))).resolves.toMatchObject({
      data: { task: { status: "DONE" } },
    });
    await expect(route(routeInput("/tasks/task%201/reopen", "POST"))).resolves.toMatchObject({
      data: { task: { status: "TODO" } },
    });
  });

  it("rejects unknown paths and unsupported methods", async () => {
    const domain = {
      listTasksForView: vi.fn(),
      createTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      completeTask: vi.fn(),
      reopenTask: vi.fn(),
    };
    const route = createTasksRoute({ domain: domain as never, prisma: healthyPrisma() });

    await expect(route(routeInput("/unknown", "GET"))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(route(routeInput("/tasks", "PUT"))).rejects.toMatchObject({ code: "METHOD_NOT_ALLOWED" });
    await expect(route(routeInput("/tasks/task-1/archive", "POST"))).rejects.toBeInstanceOf(AppError);
  });
});

describe("calendar route", () => {
  it("routes health, collection, and calendar view requests", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@example.com:5432/app";
    const domain = {
      listEventsInRange: vi.fn().mockResolvedValue([{ id: "event-1" }]),
      getCalendarData: vi.fn().mockResolvedValue({ view: "week", events: [] }),
      createEvent: vi.fn().mockResolvedValue({ id: "created" }),
      updateEvent: vi.fn(),
      deleteEvent: vi.fn(),
    };
    const route = createCalendarRoute({ domain: domain as never, prisma: healthyPrisma() });

    await expect(route(routeInput("/health", "GET"))).resolves.toMatchObject({ status: 200 });
    await expect(route(routeInput("/events?from=2026-01-01&to=2026-01-02", "GET"))).resolves.toEqual({
      status: 200,
      data: { events: [{ id: "event-1" }] },
    });
    expect(domain.listEventsInRange).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }), {
      from: "2026-01-01",
      to: "2026-01-02",
    });

    await expect(route(routeInput("/events", "POST", { title: "New event" }))).resolves.toEqual({
      status: 201,
      data: { event: { id: "created" } },
    });
    await expect(route(routeInput("/calendar?view=week&date=2026-01-01", "GET"))).resolves.toEqual({
      status: 200,
      data: { view: "week", events: [] },
    });
  });

  it("routes item requests and rejects unsupported paths", async () => {
    const domain = {
      listEventsInRange: vi.fn(),
      getCalendarData: vi.fn(),
      createEvent: vi.fn(),
      updateEvent: vi.fn().mockResolvedValue({ id: "event 1" }),
      deleteEvent: vi.fn().mockResolvedValue(undefined),
    };
    const route = createCalendarRoute({ domain: domain as never, prisma: healthyPrisma() });

    await expect(route(routeInput("/events/event%201", "PATCH", { title: "Updated" }))).resolves.toMatchObject({
      data: { event: { id: "event 1" } },
    });
    await expect(route(routeInput("/events/event%201", "DELETE"))).resolves.toEqual({
      status: 200,
      data: { deleted: true },
    });
    await expect(route(routeInput("/events", "PUT"))).rejects.toMatchObject({ code: "METHOD_NOT_ALLOWED" });
    await expect(route(routeInput("/missing", "GET"))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
