import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import {
  appendInternalHeaders,
  appendSupabaseUserHeaders,
  buildTiktoApiUrl,
  fetchTiktoService,
  getTiktoServiceForPath,
  getTiktoServiceTargets,
  readTiktoApiData,
} from "@/lib/internal-services/internal";

const envKeys = [
  "TIKTO_PROFILE_API_URL",
  "TIKTO_TASKS_API_URL",
  "TIKTO_CALENDAR_API_URL",
  "TIKTO_DASHBOARD_API_URL",
  "TIKTO_INTERNAL_API_KEY",
] as const;

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function clearTiktoEnv() {
  for (const key of envKeys) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearTiktoEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  clearTiktoEnv();

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("getTiktoServiceForPath", () => {
  it("maps public paths to the matching internal service", () => {
    expect(getTiktoServiceForPath("/profile")).toBe("profile");
    expect(getTiktoServiceForPath("tasks/task-1")).toBe("tasks");
    expect(getTiktoServiceForPath("/events/event-1")).toBe("calendar");
    expect(getTiktoServiceForPath("/calendar?view=week")).toBe("calendar");
    expect(getTiktoServiceForPath("/dashboard")).toBe("dashboard");
  });

  it("rejects paths that have no service mapping", () => {
    expect(() => getTiktoServiceForPath("/integrations/google")).toThrow(AppError);
  });
});

describe("service targets and URLs", () => {
  it("reports which service URLs are configured", () => {
    process.env.TIKTO_PROFILE_API_URL = "http://profile:4100";

    const targets = getTiktoServiceTargets();

    expect(targets).toContainEqual({
      service: "profile",
      env: "TIKTO_PROFILE_API_URL",
      configured: true,
      url: "http://profile:4100",
    });
    expect(targets.find((target) => target.service === "tasks")?.configured).toBe(false);
  });

  it("builds service URLs without duplicating trailing slashes", () => {
    process.env.TIKTO_TASKS_API_URL = "http://tasks:4200/";

    expect(buildTiktoApiUrl("/tasks/task-1")).toBe("http://tasks:4200/tasks/task-1");
  });
});

describe("headers", () => {
  it("adds encoded Supabase user context headers", () => {
    const headers = appendSupabaseUserHeaders(new Headers(), {
      id: "user-1",
      email: "person+demo@example.com",
      user_metadata: {
        full_name: "Mạnh Tân",
        avatar_url: "https://example.test/a b.png",
      },
    });

    expect(headers.get("x-tikto-user-id")).toBe("user-1");
    expect(headers.get("x-tikto-user-email")).toBe("person%2Bdemo%40example.com");
    expect(headers.get("x-tikto-user-name")).toBe("M%E1%BA%A1nh%20T%C3%A2n");
    expect(headers.get("x-tikto-user-avatar-url")).toBe("https%3A%2F%2Fexample.test%2Fa%20b.png");
  });

  it("adds the internal API key only when configured", () => {
    const missing = appendInternalHeaders(new Headers());
    expect(missing.has("x-tikto-internal-key")).toBe(false);

    process.env.TIKTO_INTERNAL_API_KEY = "secret";
    const configured = appendInternalHeaders(new Headers());
    expect(configured.get("x-tikto-internal-key")).toBe("secret");
  });
});

describe("fetchTiktoService", () => {
  it("calls the target service with no-store cache and internal auth", async () => {
    process.env.TIKTO_TASKS_API_URL = "http://tasks:4200";
    process.env.TIKTO_INTERNAL_API_KEY = "secret";
    const response = Response.json({ success: true, data: { ok: true } });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    await expect(fetchTiktoService("tasks", "/tasks", {
      headers: {
        "content-type": "application/json",
      },
    })).resolves.toBe(response);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://tasks:4200/tasks",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-tikto-internal-key")).toBe("secret");
  });
});

describe("readTiktoApiData", () => {
  it("returns data from successful API envelopes", async () => {
    const response = Response.json({ success: true, data: { task: { id: "task-1" } } });

    await expect(readTiktoApiData(response)).resolves.toEqual({ task: { id: "task-1" } });
  });

  it("throws AppError from failed API envelopes", async () => {
    const response = Response.json(
      {
        success: false,
        error: {
          code: "TASK_NOT_FOUND",
          message: "Task not found.",
        },
      },
      { status: 404 },
    );

    await expect(readTiktoApiData(response)).rejects.toMatchObject({
      status: 404,
      code: "TASK_NOT_FOUND",
      message: "Task not found.",
    });
  });
});
