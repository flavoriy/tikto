import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  requireCurrentProfile: vi.fn(),
}));

const internalMocks = vi.hoisted(() => ({
  fetchTiktoApi: vi.fn(),
  readTiktoApiData: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => authMocks);

vi.mock("@/lib/internal-services/internal", () => internalMocks);

import {
  getCalendarForView,
  getDashboard,
  getTasksForView,
} from "@/lib/internal-services/client";

const serviceResponse = new Response(null, { status: 200 });

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.requireAuthenticatedUser.mockResolvedValue({ id: "user-1" });
  authMocks.requireCurrentProfile.mockResolvedValue({ timezone: "Asia/Ho_Chi_Minh" });
  internalMocks.fetchTiktoApi.mockResolvedValue(serviceResponse);
  internalMocks.readTiktoApiData.mockResolvedValue({ ok: true });
});

function getCalledHeaders() {
  const init = internalMocks.fetchTiktoApi.mock.calls[0]?.[1] as RequestInit;
  return init.headers as Headers;
}

describe("tikto-api client", () => {
  it("fetches tasks with defined filters and authenticated context", async () => {
    await expect(getTasksForView({
      view: "today",
      status: "TODO",
      priority: "HIGH",
      search: "release notes",
    })).resolves.toEqual({ ok: true });

    expect(internalMocks.fetchTiktoApi).toHaveBeenCalledWith(
      "/tasks?view=today&status=TODO&priority=HIGH&search=release+notes",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(getCalledHeaders().get("x-tikto-user-id")).toBe("user-1");
    expect(getCalledHeaders().get("x-tikto-user-timezone")).toBe("Asia/Ho_Chi_Minh");
    expect(internalMocks.readTiktoApiData).toHaveBeenCalledWith(serviceResponse);
  });

  it("omits empty task filters", async () => {
    await getTasksForView({
      view: "",
      status: undefined,
      priority: "",
      search: null as never,
    });

    expect(internalMocks.fetchTiktoApi).toHaveBeenCalledWith(
      "/tasks",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("fetches calendar data with view and anchor date", async () => {
    await getCalendarForView({ view: "day", date: "2026-06-27" });

    expect(internalMocks.fetchTiktoApi).toHaveBeenCalledWith(
      "/calendar?view=day&date=2026-06-27",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("fetches dashboard data", async () => {
    await getDashboard();

    expect(internalMocks.fetchTiktoApi).toHaveBeenCalledWith(
      "/dashboard",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });
});
