import {
  eventIntersectsRange,
  getCalendarAnchorDate,
  getCalendarRange,
  shiftAnchor,
  sortEvents,
  toUtcFromLocal,
  type CalendarView,
} from "../../../packages/shared/src/dates/tikto-dates";
import { serializeEvent } from "../../../packages/contracts/src/serializers";
import { eventCreateSchema, eventQuerySchema } from "../../../packages/contracts/src/validations/event";
import { AppError } from "../../../packages/service-runtime/src/errors";
import type { RequestContext } from "../../../packages/service-runtime/src/http";
import type { CalendarRepository } from "./repository";

function buildEventWritePayload(input: ReturnType<typeof eventCreateSchema.parse>, timezone: string) {
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

export function createCalendarDomain(repository: CalendarRepository) {
  return {
    async listEventsInRange(
      context: RequestContext,
      query?: {
        from?: string;
        to?: string;
      },
    ) {
      const filters = eventQuerySchema.parse(query ?? {});
      const allEvents = await repository.listByUser(context.userId);

      if (!filters.from || !filters.to) {
        return sortEvents(allEvents).map(serializeEvent);
      }

      return sortEvents(
        allEvents.filter((event) => eventIntersectsRange(event, filters.from!, filters.to!, context.timezone)),
      ).map(serializeEvent);
    },

    async getCalendarData(
      context: RequestContext,
      input: {
        view?: string | null;
        date?: string | null;
      },
    ) {
      const view = (input.view === "month" || input.view === "day" ? input.view : "week") as CalendarView;
      const anchorDate = getCalendarAnchorDate(context.timezone, input.date);
      const range = getCalendarRange(anchorDate, view);
      const allEvents = await repository.listByUser(context.userId);
      const events = sortEvents(
        allEvents.filter((event) => eventIntersectsRange(event, range.start, range.end, context.timezone)),
      );

      return {
        anchorDate,
        range,
        view,
        events: events.map(serializeEvent),
        previousDate: shiftAnchor(anchorDate, view, "prev"),
        nextDate: shiftAnchor(anchorDate, view, "next"),
      };
    },

    async createEvent(context: RequestContext, payload: unknown) {
      const input = eventCreateSchema.parse(payload);
      const event = await repository.create({
        ...buildEventWritePayload(input, context.timezone),
        userId: context.userId,
      });

      return serializeEvent(event);
    },

    async updateEvent(context: RequestContext, id: string, payload: unknown) {
      const existing = await repository.findByUserAndId(context.userId, id);

      if (!existing || existing.deletedAt) {
        throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
      }

      const input = eventCreateSchema.parse(payload);
      const syncStatus = existing.googleEventId ? "PENDING_UPDATE" : existing.syncStatus;
      const event = await repository.update(id, {
        ...buildEventWritePayload(input, context.timezone),
        syncStatus,
      });

      return serializeEvent(event);
    },

    async deleteEvent(context: RequestContext, id: string) {
      const existing = await repository.findByUserAndId(context.userId, id);

      if (!existing || existing.deletedAt) {
        throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
      }

      await repository.update(id, {
        deletedAt: new Date(),
        syncStatus: existing.googleEventId ? "PENDING_DELETE" : existing.syncStatus,
      });
    },
  };
}

export type CalendarDomain = ReturnType<typeof createCalendarDomain>;
