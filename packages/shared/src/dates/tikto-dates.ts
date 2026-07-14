import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export type TaskView = "all" | "today" | "upcoming" | "overdue" | "completed";
export type CalendarView = "month" | "week" | "day";

type TaskLike = {
  dueDate: string | null;
  dueAtUtc: Date | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  createdAt: Date;
  deletedAt: Date | null;
};

type EventLike = {
  deletedAt: Date | null;
  isAllDay: boolean;
  startDate: string | null;
  endDate: string | null;
  startAtUtc: Date | null;
  endAtUtc: Date | null;
};

export function getTodayKey(timezone: string, now = new Date()) {
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

export function getDateKeyInTimeZone(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function toUtcFromLocal(date: string, time: string, timezone: string) {
  return fromZonedTime(`${date}T${time}:00`, timezone);
}

export function toLocalDateTimeLabel(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "EEE, MMM d • HH:mm");
}

export function toLocalDateLabel(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "EEE, MMM d");
}

export function formatTimeValue(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "HH:mm");
}

export function taskMatchesView(task: TaskLike, view: TaskView, timezone: string, now = new Date()) {
  if (task.deletedAt) {
    return false;
  }

  const todayKey = getTodayKey(timezone, now);
  const dueDate = task.dueDate;
  const isCompleted = task.status === "DONE";

  if (view === "all") {
    return true;
  }

  if (view === "completed") {
    return isCompleted;
  }

  if (isCompleted) {
    return false;
  }

  if (view === "today") {
    return dueDate === todayKey;
  }

  if (view === "upcoming") {
    return Boolean(dueDate && dueDate > todayKey);
  }

  if (view === "overdue") {
    if (!dueDate) {
      return false;
    }

    if (task.dueAtUtc) {
      return isAfter(now, task.dueAtUtc);
    }

    return dueDate < todayKey;
  }

  return true;
}

export function eventOccursOnDate(event: EventLike, dateKey: string, timezone: string) {
  if (event.deletedAt) {
    return false;
  }

  if (event.isAllDay) {
    if (!event.startDate || !event.endDate) {
      return false;
    }

    return event.startDate <= dateKey && event.endDate >= dateKey;
  }

  if (!event.startAtUtc || !event.endAtUtc) {
    return false;
  }

  const startKey = getDateKeyInTimeZone(event.startAtUtc, timezone);
  const endKey = getDateKeyInTimeZone(event.endAtUtc, timezone);
  return startKey <= dateKey && endKey >= dateKey;
}

export function getCalendarRange(anchorDate: string, view: CalendarView) {
  const anchor = parseISO(anchorDate);

  if (view === "day") {
    return {
      start: anchorDate,
      end: anchorDate,
      days: [anchorDate],
    };
  }

  if (view === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end }).map((day) => format(day, "yyyy-MM-dd"));

    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
      days,
    };
  }

  const monthStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const monthEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((day) =>
    format(day, "yyyy-MM-dd"),
  );

  return {
    start: format(monthStart, "yyyy-MM-dd"),
    end: format(monthEnd, "yyyy-MM-dd"),
    days,
  };
}

export function eventIntersectsRange(event: EventLike, start: string, end: string, timezone: string) {
  if (event.deletedAt) {
    return false;
  }

  if (event.isAllDay) {
    if (!event.startDate || !event.endDate) {
      return false;
    }

    return event.startDate <= end && event.endDate >= start;
  }

  if (!event.startAtUtc || !event.endAtUtc) {
    return false;
  }

  const eventStart = getDateKeyInTimeZone(event.startAtUtc, timezone);
  const eventEnd = getDateKeyInTimeZone(event.endAtUtc, timezone);
  return eventStart <= end && eventEnd >= start;
}

export function buildEventDateKeys(event: EventLike, timezone: string) {
  if (event.isAllDay) {
    if (!event.startDate || !event.endDate) {
      return [];
    }

    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);

    return eachDayOfInterval({ start, end }).map((day) => format(day, "yyyy-MM-dd"));
  }

  if (!event.startAtUtc || !event.endAtUtc) {
    return [];
  }

  const start = parseISO(getDateKeyInTimeZone(event.startAtUtc, timezone));
  const end = parseISO(getDateKeyInTimeZone(event.endAtUtc, timezone));

  return eachDayOfInterval({ start, end }).map((day) => format(day, "yyyy-MM-dd"));
}

export function getCalendarAnchorDate(timezone: string, input?: string | null) {
  if (input) {
    return input;
  }

  return getTodayKey(timezone);
}

export function sortTasks<T extends TaskLike>(tasks: T[]) {
  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) {
      if (left.status === "DONE") return 1;
      if (right.status === "DONE") return -1;
    }

    if (left.dueAtUtc && right.dueAtUtc) {
      return left.dueAtUtc.getTime() - right.dueAtUtc.getTime();
    }

    if (left.dueDate && right.dueDate) {
      return left.dueDate.localeCompare(right.dueDate);
    }

    if (left.dueDate) return -1;
    if (right.dueDate) return 1;

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

export function sortEvents<T extends EventLike>(events: T[]) {
  return [...events].sort((left, right) => {
    if (left.isAllDay !== right.isAllDay) {
      return left.isAllDay ? -1 : 1;
    }

    if (left.startAtUtc && right.startAtUtc) {
      return left.startAtUtc.getTime() - right.startAtUtc.getTime();
    }

    if (left.startDate && right.startDate) {
      return left.startDate.localeCompare(right.startDate);
    }

    return 0;
  });
}

export function formatEventHeading(event: EventLike, timezone: string) {
  if (event.isAllDay) {
    if (!event.startDate || !event.endDate) {
      return "All day";
    }

    if (event.startDate === event.endDate) {
      return event.startDate;
    }

    return `${event.startDate} → ${event.endDate}`;
  }

  if (!event.startAtUtc || !event.endAtUtc) {
    return "Time TBD";
  }

  const start = toLocalDateTimeLabel(event.startAtUtc, timezone);
  const end = formatInTimeZone(event.endAtUtc, timezone, "HH:mm");
  return `${start} → ${end}`;
}

export function toDateInputValue(value?: string | null) {
  return value ?? "";
}

export function toDateRangeDays(start: string, end: string) {
  return eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(end),
  }).map((day) => format(day, "yyyy-MM-dd"));
}

export function toHumanAnchorLabel(anchorDate: string) {
  return format(parseISO(anchorDate), "MMMM yyyy");
}

export function shiftAnchor(anchorDate: string, view: CalendarView, direction: "prev" | "next") {
  const anchor = parseISO(anchorDate);
  const amount = direction === "next" ? 1 : -1;

  if (view === "day") {
    return format(addDays(anchor, amount), "yyyy-MM-dd");
  }

  if (view === "week") {
    return format(addDays(anchor, amount * 7), "yyyy-MM-dd");
  }

  const zoned = toZonedTime(anchor, "UTC");
  const nextMonth = new Date(Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth() + amount, 1));
  return format(nextMonth, "yyyy-MM-dd");
}

export function compareNullableDates(left?: string | null, right?: string | null) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

export function isEventPast(event: EventLike, timezone: string, now = new Date()) {
  if (event.isAllDay) {
    if (!event.endDate) return false;
    return event.endDate < getTodayKey(timezone, now);
  }

  return Boolean(event.endAtUtc && isBefore(event.endAtUtc, now));
}
