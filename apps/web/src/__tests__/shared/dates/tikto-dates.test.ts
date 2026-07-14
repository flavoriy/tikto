import { describe, expect, it } from "vitest";

import {
  buildEventDateKeys,
  compareNullableDates,
  eventIntersectsRange,
  eventOccursOnDate,
  formatEventHeading,
  getCalendarAnchorDate,
  getCalendarRange,
  getDateKeyInTimeZone,
  getTodayKey,
  isEventPast,
  shiftAnchor,
  sortEvents,
  sortTasks,
  toDateInputValue,
  toDateRangeDays,
  toHumanAnchorLabel,
  toLocalDateLabel,
  toLocalDateTimeLabel,
  toUtcFromLocal,
  taskMatchesView,
} from "@shared/dates/tikto-dates";

const TZ = "Asia/Ho_Chi_Minh"; // UTC+7

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<{
  dueDate: string | null;
  dueAtUtc: Date | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  deletedAt: Date | null;
  createdAt: Date;
}> = {}) {
  return {
    dueDate: null,
    dueAtUtc: null,
    status: "TODO" as const,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<{
  deletedAt: Date | null;
  isAllDay: boolean;
  startDate: string | null;
  endDate: string | null;
  startAtUtc: Date | null;
  endAtUtc: Date | null;
}> = {}) {
  return {
    deletedAt: null,
    isAllDay: false,
    startDate: null,
    endDate: null,
    startAtUtc: null,
    endAtUtc: null,
    ...overrides,
  };
}

// ─── getTodayKey ─────────────────────────────────────────────────────────────

describe("getTodayKey", () => {
  it("returns the date in YYYY-MM-DD format for UTC+7", () => {
    // 2026-05-17T00:30:00Z → 2026-05-17T07:30:00+07:00 → "2026-05-17"
    const key = getTodayKey(TZ, new Date("2026-05-17T00:30:00Z"));
    expect(key).toBe("2026-05-17");
  });

  it("handles day boundary: UTC midnight is previous day in UTC+7", () => {
    // 2026-05-17T17:00:00Z → 2026-05-18T00:00:00+07:00 → "2026-05-18"
    const key = getTodayKey(TZ, new Date("2026-05-17T17:00:00Z"));
    expect(key).toBe("2026-05-18");
  });

  it("returns correct key for UTC timezone", () => {
    const key = getTodayKey("UTC", new Date("2026-05-17T23:59:59Z"));
    expect(key).toBe("2026-05-17");
  });
});

// ─── getDateKeyInTimeZone ────────────────────────────────────────────────────

describe("getDateKeyInTimeZone", () => {
  it("converts UTC date to local date key", () => {
    // 2026-05-17T18:00:00Z = 2026-05-18T01:00:00+07:00
    expect(getDateKeyInTimeZone(new Date("2026-05-17T18:00:00Z"), TZ)).toBe("2026-05-18");
  });

  it("same date in UTC", () => {
    expect(getDateKeyInTimeZone(new Date("2026-05-17T12:00:00Z"), "UTC")).toBe("2026-05-17");
  });
});

// ─── toUtcFromLocal ──────────────────────────────────────────────────────────

describe("toUtcFromLocal", () => {
  it("converts local date+time to UTC", () => {
    // 09:00 in UTC+7 = 02:00 UTC
    const utc = toUtcFromLocal("2026-05-17", "09:00", TZ);
    expect(utc.toISOString()).toBe("2026-05-17T02:00:00.000Z");
  });

  it("handles midnight in local time", () => {
    const utc = toUtcFromLocal("2026-05-17", "00:00", TZ);
    expect(utc.toISOString()).toBe("2026-05-16T17:00:00.000Z");
  });
});

// ─── toLocalDateTimeLabel ────────────────────────────────────────────────────

describe("toLocalDateTimeLabel", () => {
  it("formats date-time in local timezone", () => {
    const label = toLocalDateTimeLabel(new Date("2026-05-17T02:00:00Z"), TZ);
    expect(label).toBe("Sun, May 17 • 09:00");
  });
});

// ─── toLocalDateLabel ────────────────────────────────────────────────────────

describe("toLocalDateLabel", () => {
  it("formats date without time", () => {
    const label = toLocalDateLabel(new Date("2026-05-17T02:00:00Z"), TZ);
    expect(label).toBe("Sun, May 17");
  });
});

// ─── taskMatchesView ─────────────────────────────────────────────────────────

describe("taskMatchesView", () => {
  const now = new Date("2026-05-17T10:00:00Z"); // 17:00 in UTC+7 → today is 2026-05-17

  describe("deleted tasks", () => {
    it("excludes deleted tasks from every view", () => {
      const deleted = makeTask({ deletedAt: new Date(), dueDate: "2026-05-17" });
      for (const view of ["all", "today", "upcoming", "overdue", "completed"] as const) {
        expect(taskMatchesView(deleted, view, TZ, now)).toBe(false);
      }
    });
  });

  describe("view: all", () => {
    it("includes active tasks regardless of due date", () => {
      expect(taskMatchesView(makeTask({ dueDate: "2026-05-17" }), "all", TZ, now)).toBe(true);
      expect(taskMatchesView(makeTask({ dueDate: null }), "all", TZ, now)).toBe(true);
    });

    it("includes completed tasks in 'all'", () => {
      expect(taskMatchesView(makeTask({ status: "DONE" }), "all", TZ, now)).toBe(true);
    });
  });

  describe("view: completed", () => {
    it("returns only DONE tasks", () => {
      expect(taskMatchesView(makeTask({ status: "DONE" }), "completed", TZ, now)).toBe(true);
      expect(taskMatchesView(makeTask({ status: "TODO" }), "completed", TZ, now)).toBe(false);
      expect(taskMatchesView(makeTask({ status: "IN_PROGRESS" }), "completed", TZ, now)).toBe(false);
    });
  });

  describe("view: today", () => {
    it("includes task due today", () => {
      expect(taskMatchesView(makeTask({ dueDate: "2026-05-17" }), "today", TZ, now)).toBe(true);
    });

    it("excludes task due tomorrow", () => {
      expect(taskMatchesView(makeTask({ dueDate: "2026-05-18" }), "today", TZ, now)).toBe(false);
    });

    it("excludes task with no due date", () => {
      expect(taskMatchesView(makeTask({ dueDate: null }), "today", TZ, now)).toBe(false);
    });

    it("excludes completed task even if due today", () => {
      expect(
        taskMatchesView(makeTask({ dueDate: "2026-05-17", status: "DONE" }), "today", TZ, now),
      ).toBe(false);
    });
  });

  describe("view: upcoming", () => {
    it("includes task due tomorrow", () => {
      expect(taskMatchesView(makeTask({ dueDate: "2026-05-18" }), "upcoming", TZ, now)).toBe(true);
    });

    it("excludes task due today", () => {
      expect(taskMatchesView(makeTask({ dueDate: "2026-05-17" }), "upcoming", TZ, now)).toBe(false);
    });

    it("excludes task with no due date", () => {
      expect(taskMatchesView(makeTask({ dueDate: null }), "upcoming", TZ, now)).toBe(false);
    });
  });

  describe("view: overdue", () => {
    it("includes task with past dueDate (date-only)", () => {
      expect(taskMatchesView(makeTask({ dueDate: "2026-05-16" }), "overdue", TZ, now)).toBe(true);
    });

    it("excludes task with no due date", () => {
      expect(taskMatchesView(makeTask({ dueDate: null }), "overdue", TZ, now)).toBe(false);
    });

    it("uses dueAtUtc for time-precise overdue check", () => {
      const pastUtc = new Date("2026-05-17T08:00:00Z"); // 15:00 UTC+7 — before now (17:00)
      expect(
        taskMatchesView(
          makeTask({ dueDate: "2026-05-17", dueAtUtc: pastUtc }),
          "overdue",
          TZ,
          now,
        ),
      ).toBe(true);
    });

    it("not overdue when dueAtUtc is in the future", () => {
      const futureUtc = new Date("2026-05-17T12:00:00Z"); // 19:00 UTC+7 — after now
      expect(
        taskMatchesView(
          makeTask({ dueDate: "2026-05-17", dueAtUtc: futureUtc }),
          "overdue",
          TZ,
          now,
        ),
      ).toBe(false);
    });

    it("excludes completed tasks", () => {
      expect(
        taskMatchesView(makeTask({ dueDate: "2026-05-16", status: "DONE" }), "overdue", TZ, now),
      ).toBe(false);
    });
  });
});

// ─── eventOccursOnDate ───────────────────────────────────────────────────────

describe("eventOccursOnDate", () => {
  it("returns false for deleted events", () => {
    const e = makeEvent({ deletedAt: new Date(), isAllDay: true, startDate: "2026-05-17", endDate: "2026-05-17" });
    expect(eventOccursOnDate(e, "2026-05-17", TZ)).toBe(false);
  });

  describe("all-day events", () => {
    it("matches single-day all-day event on its date", () => {
      const e = makeEvent({ isAllDay: true, startDate: "2026-05-17", endDate: "2026-05-17" });
      expect(eventOccursOnDate(e, "2026-05-17", TZ)).toBe(true);
    });

    it("matches multi-day all-day event for dates within range", () => {
      const e = makeEvent({ isAllDay: true, startDate: "2026-05-15", endDate: "2026-05-20" });
      expect(eventOccursOnDate(e, "2026-05-15", TZ)).toBe(true);
      expect(eventOccursOnDate(e, "2026-05-18", TZ)).toBe(true);
      expect(eventOccursOnDate(e, "2026-05-20", TZ)).toBe(true);
    });

    it("does not match outside the date range", () => {
      const e = makeEvent({ isAllDay: true, startDate: "2026-05-15", endDate: "2026-05-20" });
      expect(eventOccursOnDate(e, "2026-05-14", TZ)).toBe(false);
      expect(eventOccursOnDate(e, "2026-05-21", TZ)).toBe(false);
    });

    it("returns false when dates are missing", () => {
      const e = makeEvent({ isAllDay: true });
      expect(eventOccursOnDate(e, "2026-05-17", TZ)).toBe(false);
    });
  });

  describe("timed events", () => {
    it("matches timed event on its date", () => {
      const e = makeEvent({
        startAtUtc: new Date("2026-05-17T02:00:00Z"), // 09:00 UTC+7
        endAtUtc: new Date("2026-05-17T04:00:00Z"),   // 11:00 UTC+7
      });
      expect(eventOccursOnDate(e, "2026-05-17", TZ)).toBe(true);
    });

    it("returns false for different date", () => {
      const e = makeEvent({
        startAtUtc: new Date("2026-05-17T02:00:00Z"),
        endAtUtc: new Date("2026-05-17T04:00:00Z"),
      });
      expect(eventOccursOnDate(e, "2026-05-18", TZ)).toBe(false);
    });

    it("returns false when UTC times are missing", () => {
      expect(eventOccursOnDate(makeEvent(), "2026-05-17", TZ)).toBe(false);
    });
  });
});

// ─── getCalendarRange ────────────────────────────────────────────────────────

describe("getCalendarRange", () => {
  describe("day view", () => {
    it("returns single day", () => {
      const r = getCalendarRange("2026-05-17", "day");
      expect(r.start).toBe("2026-05-17");
      expect(r.end).toBe("2026-05-17");
      expect(r.days).toEqual(["2026-05-17"]);
    });
  });

  describe("week view", () => {
    it("starts on Monday and ends on Sunday", () => {
      const r = getCalendarRange("2026-05-17", "week"); // Sunday
      // Week containing 2026-05-17 (Sun): Mon May 11 – Sun May 17?
      // weekStartsOn: 1 (Monday)
      // Mon 2026-05-11 to Sun 2026-05-17
      expect(r.start).toBe("2026-05-11");
      expect(r.end).toBe("2026-05-17");
      expect(r.days).toHaveLength(7);
    });

    it("includes 7 consecutive days", () => {
      const r = getCalendarRange("2026-05-20", "week"); // Wednesday
      expect(r.days).toHaveLength(7);
      expect(r.days[0]).toBe("2026-05-18"); // Monday
      expect(r.days[6]).toBe("2026-05-24"); // Sunday
    });
  });

  describe("month view", () => {
    it("returns full weeks covering the month of May 2026", () => {
      const r = getCalendarRange("2026-05-01", "month");
      // May 2026: starts on Friday, ends on Sunday (May 31)
      // First Monday on or before May 1: April 27
      // Last Sunday on or after May 31: May 31 (already Sunday)
      expect(r.days.length).toBeGreaterThanOrEqual(28);
      expect(r.days.length % 7).toBe(0);
      expect(r.days[0] <= "2026-05-01").toBe(true);
      expect(r.days[r.days.length - 1] >= "2026-05-31").toBe(true);
    });
  });
});

// ─── eventIntersectsRange ────────────────────────────────────────────────────

describe("eventIntersectsRange", () => {
  it("returns false for deleted events", () => {
    const e = makeEvent({ deletedAt: new Date(), isAllDay: true, startDate: "2026-05-10", endDate: "2026-05-15" });
    expect(eventIntersectsRange(e, "2026-05-10", "2026-05-20", TZ)).toBe(false);
  });

  it("all-day event inside range", () => {
    const e = makeEvent({ isAllDay: true, startDate: "2026-05-12", endDate: "2026-05-14" });
    expect(eventIntersectsRange(e, "2026-05-10", "2026-05-20", TZ)).toBe(true);
  });

  it("all-day event partially overlapping range start", () => {
    const e = makeEvent({ isAllDay: true, startDate: "2026-05-08", endDate: "2026-05-12" });
    expect(eventIntersectsRange(e, "2026-05-10", "2026-05-20", TZ)).toBe(true);
  });

  it("all-day event outside range", () => {
    const e = makeEvent({ isAllDay: true, startDate: "2026-05-01", endDate: "2026-05-05" });
    expect(eventIntersectsRange(e, "2026-05-10", "2026-05-20", TZ)).toBe(false);
  });

  it("timed event within range", () => {
    const e = makeEvent({
      startAtUtc: new Date("2026-05-15T02:00:00Z"),
      endAtUtc: new Date("2026-05-15T04:00:00Z"),
    });
    expect(eventIntersectsRange(e, "2026-05-10", "2026-05-20", TZ)).toBe(true);
  });

  it("timed event outside range", () => {
    const e = makeEvent({
      startAtUtc: new Date("2026-05-25T02:00:00Z"),
      endAtUtc: new Date("2026-05-25T04:00:00Z"),
    });
    expect(eventIntersectsRange(e, "2026-05-10", "2026-05-20", TZ)).toBe(false);
  });
});

// ─── buildEventDateKeys ──────────────────────────────────────────────────────

describe("buildEventDateKeys", () => {
  it("all-day single day returns one key", () => {
    const e = makeEvent({ isAllDay: true, startDate: "2026-05-17", endDate: "2026-05-17" });
    expect(buildEventDateKeys(e, TZ)).toEqual(["2026-05-17"]);
  });

  it("all-day multi-day returns all days in range", () => {
    const e = makeEvent({ isAllDay: true, startDate: "2026-05-15", endDate: "2026-05-17" });
    expect(buildEventDateKeys(e, TZ)).toEqual(["2026-05-15", "2026-05-16", "2026-05-17"]);
  });

  it("timed event returns correct day key", () => {
    const e = makeEvent({
      startAtUtc: new Date("2026-05-17T02:00:00Z"), // 09:00 UTC+7
      endAtUtc: new Date("2026-05-17T04:00:00Z"),
    });
    expect(buildEventDateKeys(e, TZ)).toEqual(["2026-05-17"]);
  });

  it("returns empty array when dates are missing", () => {
    expect(buildEventDateKeys(makeEvent({ isAllDay: true }), TZ)).toEqual([]);
    expect(buildEventDateKeys(makeEvent(), TZ)).toEqual([]);
  });
});

// ─── sortTasks ───────────────────────────────────────────────────────────────

describe("sortTasks", () => {
  const base = { dueDate: null, dueAtUtc: null, status: "TODO" as const, deletedAt: null };

  it("puts DONE tasks at the end", () => {
    const tasks = [
      { ...base, id: "done", status: "DONE" as const, createdAt: new Date("2026-01-03") },
      { ...base, id: "todo", status: "TODO" as const, createdAt: new Date("2026-01-02") },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted[0].id).toBe("todo");
    expect(sorted[1].id).toBe("done");
  });

  it("sorts by dueAtUtc ascending when both have it", () => {
    const tasks = [
      { ...base, id: "later", dueAtUtc: new Date("2026-05-20T10:00:00Z"), dueDate: "2026-05-20", createdAt: new Date("2026-01-01") },
      { ...base, id: "earlier", dueAtUtc: new Date("2026-05-18T10:00:00Z"), dueDate: "2026-05-18", createdAt: new Date("2026-01-01") },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted[0].id).toBe("earlier");
  });

  it("sorts by dueDate string when no dueAtUtc", () => {
    const tasks = [
      { ...base, id: "later", dueDate: "2026-05-20", createdAt: new Date("2026-01-01") },
      { ...base, id: "earlier", dueDate: "2026-05-18", createdAt: new Date("2026-01-01") },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted[0].id).toBe("earlier");
  });

  it("puts tasks with due dates before tasks without", () => {
    const tasks = [
      { ...base, id: "no-date", dueDate: null, createdAt: new Date("2026-01-01") },
      { ...base, id: "has-date", dueDate: "2026-05-17", createdAt: new Date("2026-01-01") },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted[0].id).toBe("has-date");
  });

  it("sorts no-due-date tasks by createdAt descending", () => {
    const tasks = [
      { ...base, id: "older", dueDate: null, createdAt: new Date("2026-01-01") },
      { ...base, id: "newer", dueDate: null, createdAt: new Date("2026-05-01") },
    ];
    const sorted = sortTasks(tasks);
    expect(sorted[0].id).toBe("newer");
  });

  it("does not mutate the original array", () => {
    const tasks = [makeTask({ dueDate: "2026-05-20" }), makeTask({ dueDate: "2026-05-18" })];
    const original = [...tasks];
    sortTasks(tasks);
    expect(tasks).toEqual(original);
  });
});

// ─── sortEvents ──────────────────────────────────────────────────────────────

describe("sortEvents", () => {
  it("places all-day events before timed events", () => {
    const events = [
      makeEvent({ isAllDay: false, startAtUtc: new Date("2026-05-17T02:00:00Z"), endAtUtc: new Date("2026-05-17T03:00:00Z") }),
      makeEvent({ isAllDay: true, startDate: "2026-05-17", endDate: "2026-05-17" }),
    ];
    const sorted = sortEvents(events);
    expect(sorted[0].isAllDay).toBe(true);
  });

  it("sorts timed events by startAtUtc ascending", () => {
    const events = [
      { ...makeEvent(), id: "later", startAtUtc: new Date("2026-05-17T10:00:00Z"), endAtUtc: new Date("2026-05-17T11:00:00Z") },
      { ...makeEvent(), id: "earlier", startAtUtc: new Date("2026-05-17T08:00:00Z"), endAtUtc: new Date("2026-05-17T09:00:00Z") },
    ];
    const sorted = sortEvents(events);
    expect((sorted[0] as typeof events[0]).id).toBe("earlier");
  });
});

// ─── formatEventHeading ──────────────────────────────────────────────────────

describe("formatEventHeading", () => {
  it("single all-day event returns the date string", () => {
    const e = makeEvent({ isAllDay: true, startDate: "2026-05-17", endDate: "2026-05-17" });
    expect(formatEventHeading(e, TZ)).toBe("2026-05-17");
  });

  it("multi-day all-day event shows range", () => {
    const e = makeEvent({ isAllDay: true, startDate: "2026-05-17", endDate: "2026-05-20" });
    expect(formatEventHeading(e, TZ)).toBe("2026-05-17 → 2026-05-20");
  });

  it("returns 'All day' when all-day dates are missing", () => {
    expect(formatEventHeading(makeEvent({ isAllDay: true }), TZ)).toBe("All day");
  });

  it("formats timed event with local times", () => {
    const e = makeEvent({
      startAtUtc: new Date("2026-05-17T02:00:00Z"), // 09:00 UTC+7
      endAtUtc: new Date("2026-05-17T04:00:00Z"),   // 11:00 UTC+7
    });
    const heading = formatEventHeading(e, TZ);
    expect(heading).toContain("09:00");
    expect(heading).toContain("11:00");
  });

  it("returns 'Time TBD' when timed event lacks UTC times", () => {
    expect(formatEventHeading(makeEvent(), TZ)).toBe("Time TBD");
  });
});

// ─── toDateInputValue ────────────────────────────────────────────────────────

describe("toDateInputValue", () => {
  it("returns the string when present", () => {
    expect(toDateInputValue("2026-05-17")).toBe("2026-05-17");
  });

  it("returns empty string for null", () => {
    expect(toDateInputValue(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(toDateInputValue(undefined)).toBe("");
  });
});

// ─── toDateRangeDays ─────────────────────────────────────────────────────────

describe("toDateRangeDays", () => {
  it("returns single day for same start and end", () => {
    expect(toDateRangeDays("2026-05-17", "2026-05-17")).toEqual(["2026-05-17"]);
  });

  it("returns all days in a range", () => {
    expect(toDateRangeDays("2026-05-17", "2026-05-19")).toEqual([
      "2026-05-17",
      "2026-05-18",
      "2026-05-19",
    ]);
  });
});

// ─── toHumanAnchorLabel ──────────────────────────────────────────────────────

describe("toHumanAnchorLabel", () => {
  it("formats to Month Year", () => {
    expect(toHumanAnchorLabel("2026-05-17")).toBe("May 2026");
    expect(toHumanAnchorLabel("2026-01-01")).toBe("January 2026");
    expect(toHumanAnchorLabel("2026-12-31")).toBe("December 2026");
  });
});

// ─── shiftAnchor ─────────────────────────────────────────────────────────────

describe("shiftAnchor", () => {
  describe("day view", () => {
    it("adds one day for next", () => {
      expect(shiftAnchor("2026-05-17", "day", "next")).toBe("2026-05-18");
    });

    it("subtracts one day for prev", () => {
      expect(shiftAnchor("2026-05-17", "day", "prev")).toBe("2026-05-16");
    });
  });

  describe("week view", () => {
    it("adds seven days for next", () => {
      expect(shiftAnchor("2026-05-17", "week", "next")).toBe("2026-05-24");
    });

    it("subtracts seven days for prev", () => {
      expect(shiftAnchor("2026-05-17", "week", "prev")).toBe("2026-05-10");
    });
  });

  describe("month view", () => {
    it("moves to next month", () => {
      expect(shiftAnchor("2026-05-17", "month", "next")).toBe("2026-06-01");
    });

    it("moves to previous month", () => {
      expect(shiftAnchor("2026-05-17", "month", "prev")).toBe("2026-04-01");
    });

    it("handles year boundary (December → January)", () => {
      expect(shiftAnchor("2026-12-15", "month", "next")).toBe("2027-01-01");
    });
  });
});

// ─── compareNullableDates ────────────────────────────────────────────────────

describe("compareNullableDates", () => {
  it("returns 0 when both are null", () => {
    expect(compareNullableDates(null, null)).toBe(0);
  });

  it("returns 1 when left is null (null sorts last)", () => {
    expect(compareNullableDates(null, "2026-05-17")).toBe(1);
  });

  it("returns -1 when right is null", () => {
    expect(compareNullableDates("2026-05-17", null)).toBe(-1);
  });

  it("compares two date strings lexicographically", () => {
    expect(compareNullableDates("2026-05-17", "2026-05-18")).toBeLessThan(0);
    expect(compareNullableDates("2026-05-18", "2026-05-17")).toBeGreaterThan(0);
    expect(compareNullableDates("2026-05-17", "2026-05-17")).toBe(0);
  });
});

// ─── getCalendarAnchorDate ───────────────────────────────────────────────────

describe("getCalendarAnchorDate", () => {
  it("returns provided date when given", () => {
    const result = getCalendarAnchorDate(TZ, "2026-06-01");
    expect(result).toBe("2026-06-01");
  });

  it("returns today when no date provided", () => {
    const today = getTodayKey(TZ);
    expect(getCalendarAnchorDate(TZ)).toBe(today);
  });

  it("returns today when null given", () => {
    const today = getTodayKey(TZ);
    expect(getCalendarAnchorDate(TZ, null)).toBe(today);
  });
});

// ─── isEventPast ─────────────────────────────────────────────────────────────

describe("isEventPast", () => {
  const now = new Date("2026-05-17T10:00:00Z");

  it("all-day event with past endDate is past", () => {
    const e = makeEvent({ isAllDay: true, startDate: "2026-05-16", endDate: "2026-05-16" });
    // today key in UTC+7 for 2026-05-17T10:00:00Z is "2026-05-17"
    expect(isEventPast(e, TZ, now)).toBe(true);
  });

  it("all-day event with future endDate is not past", () => {
    const e = makeEvent({ isAllDay: true, startDate: "2026-05-17", endDate: "2026-05-18" });
    expect(isEventPast(e, TZ, now)).toBe(false);
  });

  it("all-day event without endDate returns false", () => {
    expect(isEventPast(makeEvent({ isAllDay: true }), TZ, now)).toBe(false);
  });

  it("timed event with past endAtUtc is past", () => {
    const e = makeEvent({
      startAtUtc: new Date("2026-05-17T06:00:00Z"),
      endAtUtc: new Date("2026-05-17T08:00:00Z"), // before now (10:00)
    });
    expect(isEventPast(e, TZ, now)).toBe(true);
  });

  it("timed event with future endAtUtc is not past", () => {
    const e = makeEvent({
      startAtUtc: new Date("2026-05-17T11:00:00Z"),
      endAtUtc: new Date("2026-05-17T12:00:00Z"), // after now
    });
    expect(isEventPast(e, TZ, now)).toBe(false);
  });

  it("timed event without endAtUtc returns false", () => {
    expect(isEventPast(makeEvent(), TZ, now)).toBe(false);
  });
});
