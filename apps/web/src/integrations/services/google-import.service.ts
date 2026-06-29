import "server-only";

import { decrypt, encrypt } from "@/lib/google/crypto";
import { refreshAccessToken } from "@/lib/google/oauth";
import {
  listGoogleCalendarEvents,
  SyncTokenExpiredError,
  COLOR_MAP_REVERSE,
  shiftDate,
  type GoogleCalendarEvent,
} from "@/lib/google/calendar-client";
import {
  listGoogleTasks,
  type GoogleTask,
} from "@/lib/google/tasks-client";
import { googleIntegrationRepository } from "@/integrations/repositories/google-integration.repository";
import { eventRepository } from "@/integrations/repositories/event.repository";
import { taskRepository } from "@/integrations/repositories/task.repository";
import { prisma } from "@/lib/db/prisma";

// ---------- token helper (shared with sync service) ----------

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

// ---------- data mappers ----------

function mapGoogleEventToLocal(ge: GoogleCalendarEvent) {
  const color = ge.colorId ? (COLOR_MAP_REVERSE[ge.colorId] ?? null) : null;

  if (ge.start.date) {
    // all-day: Google end.date is exclusive → subtract 1 day for local inclusive storage
    return {
      isAllDay: true as const,
      title: ge.summary ?? "Untitled",
      description: ge.description ?? null,
      color,
      startDate: ge.start.date,
      endDate: shiftDate(ge.end.date!, -1),
      startAtUtc: null,
      endAtUtc: null,
    };
  }

  return {
    isAllDay: false as const,
    title: ge.summary ?? "Untitled",
    description: ge.description ?? null,
    color,
    startDate: null,
    endDate: null,
    startAtUtc: new Date(ge.start.dateTime!),
    endAtUtc: new Date(ge.end.dateTime!),
  };
}

function mapGoogleTaskToLocal(gt: GoogleTask) {
  const dueDate = gt.due ? gt.due.slice(0, 10) : null;
  return {
    title: gt.title || "Untitled",
    description: gt.notes ?? null,
    dueDate,
    dueTime: null as string | null,
    dueAtUtc: null as Date | null,
    status: (gt.status === "completed" ? "DONE" : "TODO") as "DONE" | "TODO",
    priority: "MEDIUM" as const,
  };
}

// Statuses where local changes are pending outbound — don't let remote overwrite
const PENDING_STATUSES = new Set(["PENDING_CREATE", "PENDING_UPDATE", "PENDING_DELETE"]);

// ---------- calendar import ----------

async function processCalendarPage(
  userId: string,
  calendarId: string,
  events: GoogleCalendarEvent[],
): Promise<{ upserted: number; deleted: number }> {
  let upserted = 0;
  let deleted = 0;

  for (const ge of events) {
    const existing = await prisma.event.findFirst({
      where: { userId, googleEventId: ge.id },
    });

    // Respect pending local changes
    if (existing && PENDING_STATUSES.has(existing.syncStatus)) continue;

    if (ge.status === "cancelled") {
      if (existing && !existing.deletedAt) {
        await eventRepository.update(existing.id, {
          deletedAt: new Date(),
          syncStatus: "SYNCED",
          lastSyncDirection: "GOOGLE_TO_APP",
          lastSyncedAt: new Date(),
        });
        deleted++;
      }
      continue;
    }

    const mapped = mapGoogleEventToLocal(ge);
    const syncFields = {
      googleEventId: ge.id,
      googleCalendarId: calendarId,
      googleEtag: ge.etag,
      googleUpdatedAt: new Date(ge.updated),
      syncStatus: "SYNCED" as const,
      lastSyncDirection: "GOOGLE_TO_APP" as const,
      lastSyncedAt: new Date(),
      syncError: null,
    };

    if (existing) {
      await eventRepository.update(existing.id, { ...mapped, ...syncFields });
    } else {
      await eventRepository.create(userId, { ...mapped, ...syncFields });
    }
    upserted++;
  }

  return { upserted, deleted };
}

export async function runCalendarSync(userId: string): Promise<void> {
  const integration = await googleIntegrationRepository.findByUserId(userId);
  if (!integration?.calendarEnabled) return;

  const calendarId = integration.calendarId ?? "primary";
  const accessToken = await getValidAccessToken(integration);

  let syncToken = integration.calendarSyncToken ?? undefined;
  let totalUpserted = 0;
  let totalDeleted = 0;

  const doSync = async (token?: string) => {
    let pageToken: string | undefined;

    do {
      let result;
      try {
        result = await listGoogleCalendarEvents(accessToken, calendarId, {
          syncToken: token,
          pageToken,
          // For full sync, fetch last 1 year + next 1 year
          timeMin: token ? undefined : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
      } catch (err) {
        if (err instanceof SyncTokenExpiredError) {
          // Reset and do full sync
          await googleIntegrationRepository.update(userId, { calendarSyncToken: null });
          await doSync(undefined);
          return;
        }
        throw err;
      }

      const { upserted, deleted } = await processCalendarPage(userId, calendarId, result.events);
      totalUpserted += upserted;
      totalDeleted += deleted;

      pageToken = result.nextPageToken;

      if (result.nextSyncToken) {
        syncToken = result.nextSyncToken;
        await googleIntegrationRepository.update(userId, {
          calendarSyncToken: result.nextSyncToken,
          lastCalendarSyncAt: new Date(),
        });
      }
    } while (pageToken);
  };

  try {
    await doSync(syncToken);
    console.log(`[google-import] calendar sync done: ${totalUpserted} upserted, ${totalDeleted} deleted`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[google-import] calendar sync error for ${userId}:`, msg);
    await googleIntegrationRepository.update(userId, { lastError: msg.slice(0, 500) });
  }
}

// ---------- tasks import ----------

async function processTasksPage(
  userId: string,
  tasklistId: string,
  tasks: GoogleTask[],
): Promise<{ upserted: number; deleted: number }> {
  let upserted = 0;
  let deleted = 0;

  for (const gt of tasks) {
    const existing = await prisma.task.findFirst({
      where: { userId, googleTaskId: gt.id },
    });

    if (existing && PENDING_STATUSES.has(existing.syncStatus)) continue;

    if (gt.deleted) {
      if (existing && !existing.deletedAt) {
        await taskRepository.update(existing.id, {
          deletedAt: new Date(),
          syncStatus: "SYNCED",
          lastSyncDirection: "GOOGLE_TO_APP",
          lastSyncedAt: new Date(),
        });
        deleted++;
      }
      continue;
    }

    const mapped = mapGoogleTaskToLocal(gt);
    const syncFields = {
      googleTaskId: gt.id,
      googleTasklistId: tasklistId,
      googleEtag: gt.etag,
      googleUpdatedAt: new Date(gt.updated),
      syncStatus: "SYNCED" as const,
      lastSyncDirection: "GOOGLE_TO_APP" as const,
      lastSyncedAt: new Date(),
      syncError: null,
    };

    if (existing) {
      await taskRepository.update(existing.id, { ...mapped, ...syncFields });
    } else {
      await taskRepository.create(userId, { ...mapped, ...syncFields });
    }
    upserted++;
  }

  return { upserted, deleted };
}

export async function runTasksSync(userId: string): Promise<void> {
  const integration = await googleIntegrationRepository.findByUserId(userId);
  if (!integration?.tasksEnabled) return;

  const tasklistId = integration.defaultTasklistId ?? "@default";
  const accessToken = await getValidAccessToken(integration);

  // Use last sync timestamp as watermark
  const updatedMin = integration.lastTasksSyncAt
    ? integration.lastTasksSyncAt.toISOString()
    : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  let totalUpserted = 0;
  let totalDeleted = 0;
  let pageToken: string | undefined;

  try {
    do {
      const result = await listGoogleTasks(accessToken, tasklistId, {
        updatedMin,
        pageToken,
        showDeleted: true,
        showCompleted: true,
        showHidden: true,
      });

      const { upserted, deleted } = await processTasksPage(userId, tasklistId, result.tasks);
      totalUpserted += upserted;
      totalDeleted += deleted;
      pageToken = result.nextPageToken;
    } while (pageToken);

    await googleIntegrationRepository.update(userId, { lastTasksSyncAt: new Date() });
    console.log(`[google-import] tasks sync done: ${totalUpserted} upserted, ${totalDeleted} deleted`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[google-import] tasks sync error for ${userId}:`, msg);
    await googleIntegrationRepository.update(userId, { lastError: msg.slice(0, 500) });
  }
}

// ---------- bootstrap: full initial import ----------

export async function bootstrapGoogleImport(userId: string): Promise<{
  calendarEvents: number;
  tasks: number;
}> {
  const integration = await googleIntegrationRepository.findByUserId(userId);
  if (!integration) throw new Error("No Google integration found");

  await googleIntegrationRepository.update(userId, {
    calendarImportState: "IN_PROGRESS",
    tasksImportState: "IN_PROGRESS",
    calendarSyncToken: null,
    lastTasksSyncAt: null,
  });

  let calendarEvents = 0;
  let tasks = 0;

  try {
    const calendarBefore = await prisma.event.count({ where: { userId, googleEventId: { not: null } } });
    await runCalendarSync(userId);
    const calendarAfter = await prisma.event.count({ where: { userId, googleEventId: { not: null } } });
    calendarEvents = calendarAfter - calendarBefore;
    await googleIntegrationRepository.update(userId, { calendarImportState: "COMPLETED" });
  } catch {
    await googleIntegrationRepository.update(userId, { calendarImportState: "FAILED" });
  }

  try {
    const tasksBefore = await prisma.task.count({ where: { userId, googleTaskId: { not: null } } });
    await runTasksSync(userId);
    const tasksAfter = await prisma.task.count({ where: { userId, googleTaskId: { not: null } } });
    tasks = tasksAfter - tasksBefore;
    await googleIntegrationRepository.update(userId, { tasksImportState: "COMPLETED" });
  } catch {
    await googleIntegrationRepository.update(userId, { tasksImportState: "FAILED" });
  }

  return { calendarEvents, tasks };
}
