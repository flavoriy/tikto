import "server-only";

import { decrypt, encrypt } from "@/lib/google/crypto";
import { refreshAccessToken } from "@/lib/google/oauth";
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from "@/lib/google/calendar-client";
import {
  createGoogleTask,
  updateGoogleTask,
  deleteGoogleTask,
} from "@/lib/google/tasks-client";
import { googleIntegrationRepository } from "@/integrations/repositories/google-integration.repository";
import { eventRepository } from "@/integrations/repositories/event.repository";
import { taskRepository } from "@/integrations/repositories/task.repository";

type GoogleIntegration = NonNullable<
  Awaited<ReturnType<typeof googleIntegrationRepository.findByUserId>>
>;

async function getValidAccessToken(integration: GoogleIntegration): Promise<string> {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (integration.tokenExpiresAt > fiveMinutesFromNow) {
    return decrypt(integration.accessTokenEncrypted);
  }

  const refreshToken = decrypt(integration.refreshTokenEncrypted);
  const refreshed = await refreshAccessToken(refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await googleIntegrationRepository.update(integration.userId, {
    accessTokenEncrypted: encrypt(refreshed.access_token),
    tokenExpiresAt: newExpiresAt,
  });

  return refreshed.access_token;
}

export async function syncEventToGoogle(userId: string, eventId: string): Promise<void> {
  const integration = await googleIntegrationRepository.findByUserId(userId);
  if (!integration?.calendarEnabled) return;

  const event = await eventRepository.findById(userId, eventId);
  if (!event || (event.deletedAt && event.syncStatus !== "PENDING_DELETE")) return;

  const calendarId = integration.calendarId ?? "primary";

  try {
    const accessToken = await getValidAccessToken(integration);

    if (event.syncStatus === "PENDING_DELETE") {
      if (event.googleEventId) {
        await deleteGoogleCalendarEvent(accessToken, calendarId, event.googleEventId);
      }
      await eventRepository.update(eventId, {
        syncStatus: "LOCAL_ONLY",
        googleEventId: null,
        googleCalendarId: null,
        googleEtag: null,
        lastSyncedAt: new Date(),
        lastSyncDirection: "APP_TO_GOOGLE",
        syncError: null,
      });
      return;
    }

    const payload = event.isAllDay
      ? {
          isAllDay: true as const,
          title: event.title,
          description: event.description,
          color: event.color,
          startDate: event.startDate!,
          endDate: event.endDate!,
        }
      : {
          isAllDay: false as const,
          title: event.title,
          description: event.description,
          color: event.color,
          startAtUtc: event.startAtUtc!,
          endAtUtc: event.endAtUtc!,
          timezone: "UTC",
        };

    let googleEventId = event.googleEventId;
    let etag: string;

    if (googleEventId) {
      const result = await updateGoogleCalendarEvent(accessToken, calendarId, googleEventId, payload);
      etag = result.etag;
    } else {
      const result = await createGoogleCalendarEvent(accessToken, calendarId, payload);
      googleEventId = result.id;
      etag = result.etag;
    }

    await eventRepository.update(eventId, {
      syncStatus: "SYNCED",
      googleEventId,
      googleCalendarId: calendarId,
      googleEtag: etag,
      lastSyncedAt: new Date(),
      lastSyncDirection: "APP_TO_GOOGLE",
      syncError: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[google-sync] event ${eventId} failed:`, message);
    await eventRepository.update(eventId, {
      syncStatus: "FAILED",
      syncError: message.slice(0, 500),
    });
  }
}

export async function syncTaskToGoogle(userId: string, taskId: string): Promise<void> {
  const integration = await googleIntegrationRepository.findByUserId(userId);
  if (!integration?.tasksEnabled) return;

  const task = await taskRepository.findById(userId, taskId);
  if (!task || (task.deletedAt && task.syncStatus !== "PENDING_DELETE")) return;

  const tasklistId = integration.defaultTasklistId ?? "@default";

  try {
    const accessToken = await getValidAccessToken(integration);

    if (task.syncStatus === "PENDING_DELETE") {
      if (task.googleTaskId) {
        await deleteGoogleTask(accessToken, tasklistId, task.googleTaskId);
      }
      await taskRepository.update(taskId, {
        syncStatus: "LOCAL_ONLY",
        googleTaskId: null,
        googleTasklistId: null,
        googleEtag: null,
        lastSyncedAt: new Date(),
        lastSyncDirection: "APP_TO_GOOGLE",
        syncError: null,
      });
      return;
    }

    const payload = {
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      completed: task.status === "DONE",
    };

    let googleTaskId = task.googleTaskId;
    let etag: string;

    if (googleTaskId) {
      const result = await updateGoogleTask(accessToken, tasklistId, googleTaskId, payload);
      etag = result.etag;
    } else {
      const result = await createGoogleTask(accessToken, tasklistId, payload);
      googleTaskId = result.id;
      etag = result.etag;
    }

    await taskRepository.update(taskId, {
      syncStatus: "SYNCED",
      googleTaskId,
      googleTasklistId: tasklistId,
      googleEtag: etag,
      lastSyncedAt: new Date(),
      lastSyncDirection: "APP_TO_GOOGLE",
      syncError: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[google-sync] task ${taskId} failed:`, message);
    await taskRepository.update(taskId, {
      syncStatus: "FAILED",
      syncError: message.slice(0, 500),
    });
  }
}
