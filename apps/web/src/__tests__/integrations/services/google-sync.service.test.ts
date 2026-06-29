import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Event, GoogleIntegration, Task } from "@prisma/client";

vi.mock("@/lib/google/crypto", () => ({
  decrypt: vi.fn(),
  encrypt: vi.fn(),
}));

vi.mock("@/lib/google/oauth", () => ({
  refreshAccessToken: vi.fn(),
}));

vi.mock("@/lib/google/calendar-client", () => ({
  createGoogleCalendarEvent: vi.fn(),
  updateGoogleCalendarEvent: vi.fn(),
  deleteGoogleCalendarEvent: vi.fn(),
}));

vi.mock("@/lib/google/tasks-client", () => ({
  createGoogleTask: vi.fn(),
  updateGoogleTask: vi.fn(),
  deleteGoogleTask: vi.fn(),
}));

vi.mock("@/integrations/repositories/google-integration.repository", () => ({
  googleIntegrationRepository: {
    findByUserId: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/integrations/repositories/event.repository", () => ({
  eventRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/integrations/repositories/task.repository", () => ({
  taskRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

import { decrypt } from "@/lib/google/crypto";
import { deleteGoogleCalendarEvent } from "@/lib/google/calendar-client";
import { deleteGoogleTask } from "@/lib/google/tasks-client";
import { googleIntegrationRepository } from "@/integrations/repositories/google-integration.repository";
import { eventRepository } from "@/integrations/repositories/event.repository";
import { taskRepository } from "@/integrations/repositories/task.repository";
import { syncEventToGoogle, syncTaskToGoogle } from "@/integrations/services/google-sync.service";

const fixedNow = new Date("2026-05-17T08:00:00.000Z");

function makeIntegration(overrides: Partial<GoogleIntegration> = {}): GoogleIntegration {
  return {
    id: "integration-1",
    userId: "user-1",
    googleAccountEmail: "person@example.com",
    accessTokenEncrypted: "encrypted-access-token",
    refreshTokenEncrypted: "encrypted-refresh-token",
    tokenExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
    calendarEnabled: true,
    tasksEnabled: true,
    calendarId: "primary",
    defaultTasklistId: "@default",
    calendarImportState: "COMPLETED",
    tasksImportState: "COMPLETED",
    calendarImportSummary: null,
    tasksImportSummary: null,
    calendarSyncToken: null,
    calendarWatchChannelId: null,
    calendarWatchResourceId: null,
    calendarWatchExpireAt: null,
    lastCalendarSyncAt: null,
    lastTasksSyncAt: null,
    lastError: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    userId: "user-1",
    title: "Team sync",
    description: null,
    color: "teal",
    isAllDay: false,
    startAtUtc: new Date("2026-05-18T02:00:00.000Z"),
    endAtUtc: new Date("2026-05-18T03:00:00.000Z"),
    startDate: null,
    endDate: null,
    googleEventId: "google-event-1",
    googleCalendarId: "primary",
    googleEtag: "etag-1",
    googleUpdatedAt: null,
    syncStatus: "SYNCED",
    lastSyncDirection: null,
    lastSyncedAt: null,
    syncError: null,
    deletedAt: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
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
    googleTaskId: "google-task-1",
    googleTasklistId: "@default",
    googleEtag: "etag-1",
    googleUpdatedAt: null,
    syncStatus: "SYNCED",
    lastSyncDirection: null,
    lastSyncedAt: null,
    syncError: null,
    deletedAt: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ...overrides,
  };
}

describe("google-sync.service", () => {
  const mockDecrypt = vi.mocked(decrypt);
  const mockDeleteGoogleCalendarEvent = vi.mocked(deleteGoogleCalendarEvent);
  const mockDeleteGoogleTask = vi.mocked(deleteGoogleTask);
  const mockGoogleIntegrationRepository = vi.mocked(googleIntegrationRepository);
  const mockEventRepository = vi.mocked(eventRepository);
  const mockTaskRepository = vi.mocked(taskRepository);

  beforeEach(() => {
    vi.clearAllMocks();
    mockDecrypt.mockReturnValue("access-token");
    mockGoogleIntegrationRepository.findByUserId.mockResolvedValue(makeIntegration());
  });

  it("deletes a soft-deleted event from Google when sync status is pending delete", async () => {
    mockEventRepository.findById.mockResolvedValue(
      makeEvent({
        deletedAt: fixedNow,
        syncStatus: "PENDING_DELETE",
      }),
    );

    await syncEventToGoogle("user-1", "event-1");

    expect(mockDeleteGoogleCalendarEvent).toHaveBeenCalledWith(
      "access-token",
      "primary",
      "google-event-1",
    );
    expect(mockEventRepository.update).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({
        syncStatus: "LOCAL_ONLY",
        googleEventId: null,
        googleCalendarId: null,
        googleEtag: null,
        lastSyncDirection: "APP_TO_GOOGLE",
        syncError: null,
      }),
    );
  });

  it("deletes a soft-deleted task from Google when sync status is pending delete", async () => {
    mockTaskRepository.findById.mockResolvedValue(
      makeTask({
        deletedAt: fixedNow,
        syncStatus: "PENDING_DELETE",
      }),
    );

    await syncTaskToGoogle("user-1", "task-1");

    expect(mockDeleteGoogleTask).toHaveBeenCalledWith("access-token", "@default", "google-task-1");
    expect(mockTaskRepository.update).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({
        syncStatus: "LOCAL_ONLY",
        googleTaskId: null,
        googleTasklistId: null,
        googleEtag: null,
        lastSyncDirection: "APP_TO_GOOGLE",
        syncError: null,
      }),
    );
  });
});
