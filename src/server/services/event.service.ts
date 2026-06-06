import "server-only";

import { eventQuerySchema, eventCreateSchema } from "@/lib/validations/event";
import { AppError } from "@/lib/errors";
import { formatInTimeZone } from "date-fns-tz";

import {
  buildEventDateKeys,
  eventIntersectsRange,
  getCalendarAnchorDate,
  getCalendarRange,
  shiftAnchor,
  sortEvents,
  toUtcFromLocal,
  type CalendarView,
} from "@/lib/dates/taskflow-dates";
import { eventRepository } from "@/server/repositories/event.repository";
import { syncEventToGoogle } from "@/server/services/google-sync.service";
import { syncEventReminders } from "@/server/services/reminder.service";

type EventListInput = {
  userId: string;
  timezone: string;
  query?: {
    from?: string;
    to?: string;
  };
};

export async function listEventsInRange({ userId, timezone, query }: EventListInput) {
  const filters = eventQuerySchema.parse(query ?? {});
  const allEvents = await eventRepository.listByUser(userId);

  if (!filters.from || !filters.to) {
    return sortEvents(allEvents);
  }

  return sortEvents(allEvents.filter((event) => eventIntersectsRange(event, filters.from!, filters.to!, timezone)));
}

export async function getCalendarData({
  userId,
  timezone,
  view,
  date,
}: {
  userId: string;
  timezone: string;
  view: CalendarView;
  date?: string | null;
}) {
  const anchorDate = getCalendarAnchorDate(timezone, date);
  const range = getCalendarRange(anchorDate, view);
  const events = await listEventsInRange({
    userId,
    timezone,
    query: {
      from: range.start,
      to: range.end,
    },
  });

  return {
    anchorDate,
    range,
    view,
    events,
    previousDate: shiftAnchor(anchorDate, view, "prev"),
    nextDate: shiftAnchor(anchorDate, view, "next"),
  };
}

function buildEventWritePayload(
  input: ReturnType<typeof eventCreateSchema.parse>,
  timezone: string,
) {
  const color = input.color ?? "teal";

  if (input.isAllDay) {
    return {
      title: input.title,
      description: input.description ?? null,
      color,
      isAllDay: true,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      startAtUtc: null,
      endAtUtc: null,
    };
  }

  if (!input.startLocal || !input.endLocal) {
    throw new AppError(400, "INVALID_EVENT", "Timed events require start and end date-times.");
  }

  const [startDate, startTime] = input.startLocal.split("T");
  const [endDate, endTime] = input.endLocal.split("T");
  const startAtUtc = toUtcFromLocal(startDate, startTime, timezone);
  const endAtUtc = toUtcFromLocal(endDate, endTime, timezone);

  if (endAtUtc.getTime() <= startAtUtc.getTime()) {
    throw new AppError(400, "INVALID_EVENT_RANGE", "End time must be after start time.");
  }

  return {
    title: input.title,
    description: input.description ?? null,
    color,
    isAllDay: false,
    startDate: null,
    endDate: null,
    startAtUtc,
    endAtUtc,
  };
}

type EventMutationInput = {
  userId: string;
  timezone: string;
  payload: unknown;
};

export async function createEvent({ userId, timezone, payload }: EventMutationInput) {
  const input = eventCreateSchema.parse(payload);
  const event = await eventRepository.create(userId, buildEventWritePayload(input, timezone));
  await syncEventReminders({
    userId,
    event,
    reminderOffsetsMinutes: input.reminderOffsetsMinutes,
  });
  void syncEventToGoogle(userId, event.id);
  return event;
}

export async function updateEvent({ userId, timezone, payload, id }: EventMutationInput & { id: string }) {
  const existing = await eventRepository.findById(userId, id);

  if (!existing || existing.deletedAt) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
  }

  const input = eventCreateSchema.parse(payload);
  const syncStatus = existing.googleEventId ? "PENDING_UPDATE" : existing.syncStatus;
  const event = await eventRepository.update(id, { ...buildEventWritePayload(input, timezone), syncStatus });
  await syncEventReminders({
    userId,
    event,
    reminderOffsetsMinutes: input.reminderOffsetsMinutes,
  });
  void syncEventToGoogle(userId, id);
  return event;
}

export async function deleteEvent(userId: string, id: string) {
  const existing = await eventRepository.findById(userId, id);

  if (!existing || existing.deletedAt) {
    throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
  }

  const event = await eventRepository.update(id, {
    deletedAt: new Date(),
    syncStatus: existing.googleEventId ? "PENDING_DELETE" : existing.syncStatus,
  });
  await syncEventReminders({
    userId,
    event,
  });
  if (existing.googleEventId) {
    void syncEventToGoogle(userId, id);
  }
  return event;
}

export function getEventFormDefaults(timezone: string, dateKey?: string) {
  const baseDate = dateKey ?? getCalendarAnchorDate(timezone);
  return {
    title: "",
    description: "",
    color: "teal",
    isAllDay: false,
    startLocal: `${baseDate}T09:00`,
    endLocal: `${baseDate}T10:00`,
    startDate: baseDate,
    endDate: baseDate,
  };
}

export function getEventDisplayDateKeys(event: Awaited<ReturnType<typeof getCalendarData>>["events"][number], timezone: string) {
  return buildEventDateKeys(event, timezone);
}

export function toEventLocalInputValue(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm");
}
