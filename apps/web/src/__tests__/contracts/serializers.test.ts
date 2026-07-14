import { describe, expect, it } from "vitest";

import { serializeEvent, serializeProfile, serializeTask } from "@contracts/serializers";

const now = new Date("2026-05-17T10:00:00Z");

describe("serializeTask", () => {
  const base = {
    id: "task-1",
    title: "Buy milk",
    description: null,
    status: "TODO" as const,
    priority: "MEDIUM" as const,
    dueDate: "2026-05-20",
    dueTime: "09:00",
    dueAtUtc: new Date("2026-05-20T02:00:00Z"),
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  it("converts Date fields to ISO strings", () => {
    const result = serializeTask(base);
    expect(result.dueAtUtc).toBe("2026-05-20T02:00:00.000Z");
    expect(result.createdAt).toBe("2026-05-17T10:00:00.000Z");
    expect(result.updatedAt).toBe("2026-05-17T10:00:00.000Z");
  });

  it("serializes null Dates as null", () => {
    const result = serializeTask({ ...base, dueAtUtc: null, completedAt: null });
    expect(result.dueAtUtc).toBeNull();
    expect(result.completedAt).toBeNull();
  });

  it("serializes completedAt when present", () => {
    const completed = new Date("2026-05-17T12:00:00Z");
    const result = serializeTask({ ...base, completedAt: completed });
    expect(result.completedAt).toBe("2026-05-17T12:00:00.000Z");
  });

  it("passes through scalar fields unchanged", () => {
    const result = serializeTask(base);
    expect(result.id).toBe("task-1");
    expect(result.title).toBe("Buy milk");
    expect(result.status).toBe("TODO");
    expect(result.priority).toBe("MEDIUM");
    expect(result.dueDate).toBe("2026-05-20");
    expect(result.dueTime).toBe("09:00");
  });
});

describe("serializeEvent", () => {
  const base = {
    id: "evt-1",
    title: "Team meeting",
    description: "Weekly sync",
    color: "teal",
    isAllDay: false,
    startAtUtc: new Date("2026-05-17T09:00:00Z"),
    endAtUtc: new Date("2026-05-17T10:00:00Z"),
    startDate: null,
    endDate: null,
    createdAt: now,
    updatedAt: now,
  };

  it("converts Date fields to ISO strings", () => {
    const result = serializeEvent(base);
    expect(result.startAtUtc).toBe("2026-05-17T09:00:00.000Z");
    expect(result.endAtUtc).toBe("2026-05-17T10:00:00.000Z");
  });

  it("serializes null date fields as null", () => {
    const result = serializeEvent({ ...base, startAtUtc: null, endAtUtc: null });
    expect(result.startAtUtc).toBeNull();
    expect(result.endAtUtc).toBeNull();
  });

  it("handles all-day events with date strings", () => {
    const result = serializeEvent({
      ...base,
      isAllDay: true,
      startAtUtc: null,
      endAtUtc: null,
      startDate: "2026-05-17",
      endDate: "2026-05-19",
    });
    expect(result.isAllDay).toBe(true);
    expect(result.startDate).toBe("2026-05-17");
    expect(result.endDate).toBe("2026-05-19");
    expect(result.startAtUtc).toBeNull();
  });

  it("passes through scalar fields", () => {
    const result = serializeEvent(base);
    expect(result.id).toBe("evt-1");
    expect(result.title).toBe("Team meeting");
    expect(result.color).toBe("teal");
  });
});

describe("serializeProfile", () => {
  it("returns all profile fields", () => {
    const result = serializeProfile({
      id: "user-1",
      email: "test@example.com",
      name: "Alice",
      avatarUrl: "https://example.com/avatar.png",
      timezone: "Asia/Ho_Chi_Minh",
    });
    expect(result).toEqual({
      id: "user-1",
      email: "test@example.com",
      name: "Alice",
      avatarUrl: "https://example.com/avatar.png",
      timezone: "Asia/Ho_Chi_Minh",
    });
  });

  it("allows null name and avatarUrl", () => {
    const result = serializeProfile({
      id: "user-2",
      email: "b@b.com",
      name: null,
      avatarUrl: null,
      timezone: "UTC",
    });
    expect(result.name).toBeNull();
    expect(result.avatarUrl).toBeNull();
  });
});
