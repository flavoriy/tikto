import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";

const authMocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  requireCurrentProfile: vi.fn(),
}));

const internalMocks = vi.hoisted(() => ({
  fetchTiktoApi: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => authMocks);

vi.mock("@/lib/internal-services/internal", () => internalMocks);

import { proxyTiktoApiRequest } from "@/lib/internal-services/proxy";

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.requireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
  authMocks.requireCurrentProfile.mockResolvedValue({ timezone: "Asia/Ho_Chi_Minh" });
});

describe("proxyTiktoApiRequest", () => {
  it("forwards method, query, body, and authenticated headers to the internal service", async () => {
    internalMocks.fetchTiktoApi.mockResolvedValue(
      Response.json({ success: true, data: { task: { id: "task-1" } } }, { status: 201 }),
    );
    const request = new Request("https://tikto.test/api/tasks?view=today", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Ship refactor" }),
    });

    const response = await proxyTiktoApiRequest(request, "/tasks");

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        task: {
          id: "task-1",
        },
      },
    });
    expect(internalMocks.fetchTiktoApi).toHaveBeenCalledWith(
      "/tasks?view=today",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
        body: expect.any(ArrayBuffer),
      }),
    );
    const init = internalMocks.fetchTiktoApi.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-tikto-user-id")).toBe("user-1");
    expect(headers.get("x-tikto-user-timezone")).toBe("Asia/Ho_Chi_Minh");
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"title":"Ship refactor"}');
  });

  it("does not forward bodies for GET requests", async () => {
    internalMocks.fetchTiktoApi.mockResolvedValue(
      Response.json({ success: true, data: { tasks: [] } }),
    );

    await proxyTiktoApiRequest(new Request("https://tikto.test/api/tasks", { method: "GET" }), "/tasks");

    const init = internalMocks.fetchTiktoApi.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
  });

  it("returns API errors when authentication fails before proxying", async () => {
    authMocks.requireAuthenticatedUser.mockRejectedValue(
      new AppError(401, "UNAUTHORIZED", "You must be signed in."),
    );

    const response = await proxyTiktoApiRequest(
      new Request("https://tikto.test/api/tasks", { method: "GET" }),
      "/tasks",
    );

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "You must be signed in.",
      },
    });
    expect(response.status).toBe(401);
    expect(internalMocks.fetchTiktoApi).not.toHaveBeenCalled();
  });
});
