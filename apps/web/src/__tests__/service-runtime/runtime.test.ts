import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { IncomingMessage } from "node:http";

import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceDatabaseClient, getDatabaseUrl, getPrismaLogLevels } from "../../../../../packages/service-runtime/src/db";
import { AppError, toApiError } from "../../../../../packages/service-runtime/src/errors";
import { getServiceHealth } from "../../../../../packages/service-runtime/src/health";
import {
  createJsonServiceServer,
  headerValue,
  ok,
  readJson,
  requireContext,
  requireInternalRequest,
} from "../../../../../packages/service-runtime/src/http";

const envKeys = [
  "CALENDAR_DATABASE_URL",
  "DATABASE_URL",
  "HOSTNAME",
  "LOG_HEALTHCHECKS",
  "LOG_LEVEL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NODE_ENV",
  "PORT",
  "PROFILE_DATABASE_URL",
  "TASKS_DATABASE_URL",
  "TIKTO_CALENDAR_API_URL",
  "TIKTO_DASHBOARD_API_URL",
  "TIKTO_INTERNAL_API_KEY",
  "TIKTO_PROFILE_API_URL",
  "TIKTO_TASKS_API_URL",
  "TOKEN_ENCRYPTION_KEY",
] as const;

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function restoreEnv() {
  for (const key of envKeys) {
    const value = originalEnv[key];

    if (value === undefined) {
      delete process.env[key];
    } else {
      (process.env as Record<string, string | undefined>)[key] = value;
    }
  }
}

function clearEnv() {
  for (const key of envKeys) {
    delete process.env[key];
  }
}

function mockRequest(headers: Record<string, string | string[] | undefined> = {}, chunks: Array<string | Buffer> = []) {
  return {
    headers,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as unknown as IncomingMessage;
}

beforeEach(() => {
  clearEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  restoreEnv();
  delete (globalThis as typeof globalThis & { tiktoPrismaClients?: unknown }).tiktoPrismaClients;
});

describe("service runtime errors", () => {
  it("serializes AppError and validation errors", () => {
    expect(toApiError(new AppError(404, "NOT_FOUND", "Missing."))).toEqual({
      status: 404,
      body: {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Missing.",
        },
      },
    });

    const schemaError = z.object({ name: z.string().min(3) }).safeParse({ name: "x" });
    expect(schemaError.success).toBe(false);

    if (!schemaError.success) {
      expect(toApiError(schemaError.error)).toMatchObject({
        status: 400,
        body: {
          error: {
            code: "VALIDATION_ERROR",
          },
        },
      });
    }
  });

  it("hides unexpected errors behind a generic API envelope", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(toApiError(new Error("database password is secret"))).toEqual({
      status: 500,
      body: {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong.",
        },
      },
    });
  });
});

describe("database runtime", () => {
  it("reads database URLs from service-specific env with DATABASE_URL fallback", () => {
    process.env.DATABASE_URL = "postgresql://fallback:pass@example.com:5432/app";
    expect(getDatabaseUrl("TASKS_DATABASE_URL")).toBe(process.env.DATABASE_URL);

    process.env.TASKS_DATABASE_URL = "postgresql://tasks:pass@example.com:5432/tasks";
    expect(getDatabaseUrl("TASKS_DATABASE_URL")).toBe(process.env.TASKS_DATABASE_URL);
  });

  it("reports missing and invalid database URLs", () => {
    expect(() => getDatabaseUrl("TASKS_DATABASE_URL")).toThrow("Missing TASKS_DATABASE_URL or DATABASE_URL");

    process.env.DATABASE_URL = "not a url";
    expect(() => getDatabaseUrl()).toThrow("Invalid database URL");
  });

  it("caches clients outside production and keeps production uncached", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@example.com:5432/app";
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    const createClient = vi.fn(({ datasourceUrl, log }) => ({ datasourceUrl, log, $disconnect: vi.fn() }));

    const first = createServiceDatabaseClient("tasks", "TASKS_DATABASE_URL", createClient);
    const second = createServiceDatabaseClient("tasks", "TASKS_DATABASE_URL", createClient);

    expect(first).toBe(second);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(getPrismaLogLevels()).toEqual(["warn", "error"]);

    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(getPrismaLogLevels()).toEqual(["error"]);
  });
});

describe("HTTP runtime helpers", () => {
  it("reads headers, validates internal auth, and decodes request context", () => {
    const request = mockRequest({
      "x-tikto-internal-key": "secret",
      "x-tikto-user-id": "user-1",
      "x-tikto-user-timezone": "UTC",
      "x-tikto-user-email": "person%2Bdemo%40example.com",
      "x-tikto-user-name": "M%E1%BA%A1nh%20T%C3%A2n",
    });

    expect(headerValue(request, "x-tikto-user-id")).toBe("user-1");

    process.env.TIKTO_INTERNAL_API_KEY = "secret";
    expect(() => requireInternalRequest(request)).not.toThrow();
    expect(requireContext(request)).toMatchObject({
      userId: "user-1",
      timezone: "UTC",
      email: "person+demo@example.com",
      name: "Mạnh Tân",
    });
  });

  it("rejects invalid internal auth and missing user context", () => {
    process.env.TIKTO_INTERNAL_API_KEY = "secret";

    expect(() => requireInternalRequest(mockRequest({ "x-tikto-internal-key": "bad" }))).toThrow(AppError);
    expect(() => requireContext(mockRequest())).toThrow(AppError);
  });

  it("parses JSON bodies and rejects invalid or oversized payloads", async () => {
    await expect(readJson(mockRequest({}, [JSON.stringify({ ok: true })]))).resolves.toEqual({ ok: true });
    await expect(readJson(mockRequest({}, ["   "]))).resolves.toBeUndefined();
    await expect(readJson(mockRequest({}, ["{"]))).rejects.toMatchObject({ code: "INVALID_JSON" });
    await expect(readJson(mockRequest({}, [Buffer.alloc(1_000_001)]))).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("serves JSON responses with request IDs and sanitized logs", async () => {
    process.env.PORT = "0";
    process.env.HOSTNAME = "127.0.0.1";
    process.env.LOG_HEALTHCHECKS = "true";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const server = createJsonServiceServer({
      serviceName: "test-service",
      defaultPort: 0,
      async route({ pathname }) {
        if (pathname === "/boom") {
          throw new AppError(418, "TEAPOT", "No coffee.");
        }

        return ok({ pathname });
      },
    });

    await once(server, "listening");
    const port = (server.address() as AddressInfo).port;

    const success = await fetch(`http://127.0.0.1:${port}/hello//`, {
      headers: {
        "x-request-id": "external-request-id",
      },
    });
    await expect(success.json()).resolves.toEqual({ success: true, data: { pathname: "/hello" } });
    expect(success.headers.get("x-request-id")).toBe("external-request-id");

    const failure = await fetch(`http://127.0.0.1:${port}/boom`);
    await expect(failure.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "TEAPOT",
      },
    });

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    const logPayloads = logSpy.mock.calls.map(([value]) => JSON.parse(String(value)) as Record<string, unknown>);
    expect(logPayloads.some((payload) => payload.event === "service_listening" && payload.port === 0)).toBe(true);
    expect(logPayloads.some((payload) => payload.event === "http_request" && payload.status === 418)).toBe(true);
    expect(logPayloads.some((payload) => "requestId" in payload || "path" in payload || "traceparent" in payload)).toBe(false);
  });
});

describe("service health", () => {
  it("reports database, dependency, Supabase, and encryption status", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@db.project.supabase.co:5432/app";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    process.env.TIKTO_INTERNAL_API_KEY = "internal-secret";
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]),
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ exists: "public.tasks" }]),
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true, data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const health = await getServiceHealth({
      serviceName: "tasks",
      prisma,
      ownedTables: ["public.tasks"],
      dependencies: [
        {
          service: "calendar",
          env: "CALENDAR_API_URL",
          url: "https://calendar.internal///",
        },
      ],
      requiredEnv: ["DATABASE_URL"],
    });

    expect(health.ok).toBe(true);
    expect(health.databaseUrl).toMatchObject({
      configured: true,
      hostKind: "supabase-direct",
    });
    expect(health.database).toMatchObject({ ok: true });
    expect(health.encryption).toMatchObject({ validBase64: true, validLength: true, byteLength: 32 });
    expect(health.supabase).toEqual({
      publicKeyConfigured: true,
      keySource: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://calendar.internal/health", expect.any(Object));
  });

  it("marks missing dependencies and database failures as unhealthy without leaking secrets", async () => {
    process.env.DATABASE_URL = "postgresql://user:secret@example.com:5432/app";
    process.env.TOKEN_ENCRYPTION_KEY = "not-base64";
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error(`Could not connect to ${process.env.DATABASE_URL}`)),
      $queryRawUnsafe: vi.fn(),
    };

    const health = await getServiceHealth({
      serviceName: "calendar",
      prisma,
      dependencies: [
        {
          service: "tasks",
          env: "TIKTO_TASKS_API_URL",
        },
      ],
    });

    expect(health.ok).toBe(false);
    expect(health.database).toMatchObject({ ok: false });
    expect(JSON.stringify(health.database)).not.toContain("secret");
    expect(health.dependencies[0]).toMatchObject({ configured: false, ok: false });
  });
});
