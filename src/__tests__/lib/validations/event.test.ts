import { describe, expect, it } from "vitest";

import { eventCreateSchema, eventQuerySchema } from "@/lib/validations/event";

describe("eventCreateSchema", () => {
  describe("title", () => {
    it("accepts a valid title", () => {
      const result = eventCreateSchema.parse({
        title: "Team meeting",
        isAllDay: true,
        startDate: "2026-05-17",
        endDate: "2026-05-17",
      });
      expect(result.title).toBe("Team meeting");
    });

    it("trims title whitespace", () => {
      const result = eventCreateSchema.parse({
        title: "  Standup  ",
        isAllDay: true,
        startDate: "2026-05-17",
        endDate: "2026-05-17",
      });
      expect(result.title).toBe("Standup");
    });

    it("rejects empty title", () => {
      expect(() =>
        eventCreateSchema.parse({ title: "", isAllDay: false, startLocal: "2026-05-17T09:00", endLocal: "2026-05-17T10:00" }),
      ).toThrow();
    });

    it("rejects title over 120 characters", () => {
      expect(() =>
        eventCreateSchema.parse({
          title: "a".repeat(121),
          isAllDay: false,
          startLocal: "2026-05-17T09:00",
          endLocal: "2026-05-17T10:00",
        }),
      ).toThrow();
    });
  });

  describe("all-day events", () => {
    it("accepts valid all-day event", () => {
      const result = eventCreateSchema.parse({
        title: "Holiday",
        isAllDay: true,
        startDate: "2026-12-25",
        endDate: "2026-12-25",
      });
      expect(result.isAllDay).toBe(true);
      expect(result.startDate).toBe("2026-12-25");
      expect(result.endDate).toBe("2026-12-25");
    });

    it("accepts multi-day all-day event", () => {
      const result = eventCreateSchema.parse({
        title: "Vacation",
        isAllDay: true,
        startDate: "2026-08-01",
        endDate: "2026-08-07",
      });
      expect(result.startDate).toBe("2026-08-01");
      expect(result.endDate).toBe("2026-08-07");
    });

    it("rejects all-day event without dates", () => {
      expect(() => eventCreateSchema.parse({ title: "Holiday", isAllDay: true })).toThrow();
    });

    it("rejects all-day event with only startDate", () => {
      expect(() =>
        eventCreateSchema.parse({ title: "Holiday", isAllDay: true, startDate: "2026-12-25" }),
      ).toThrow();
    });

    it("rejects invalid startDate format", () => {
      expect(() =>
        eventCreateSchema.parse({
          title: "T",
          isAllDay: true,
          startDate: "25-12-2026",
          endDate: "2026-12-25",
        }),
      ).toThrow();
    });
  });

  describe("timed events", () => {
    it("accepts valid timed event", () => {
      const result = eventCreateSchema.parse({
        title: "Call",
        isAllDay: false,
        startLocal: "2026-05-17T09:00",
        endLocal: "2026-05-17T10:00",
      });
      expect(result.startLocal).toBe("2026-05-17T09:00");
      expect(result.endLocal).toBe("2026-05-17T10:00");
    });

    it("rejects timed event without startLocal/endLocal", () => {
      expect(() =>
        eventCreateSchema.parse({ title: "Call", isAllDay: false }),
      ).toThrow();
    });

    it("rejects timed event missing endLocal", () => {
      expect(() =>
        eventCreateSchema.parse({ title: "Call", isAllDay: false, startLocal: "2026-05-17T09:00" }),
      ).toThrow();
    });

    it("treats empty startLocal as undefined (triggers validation)", () => {
      expect(() =>
        eventCreateSchema.parse({
          title: "Call",
          isAllDay: false,
          startLocal: "",
          endLocal: "2026-05-17T10:00",
        }),
      ).toThrow();
    });
  });

  describe("optional fields", () => {
    it("accepts description", () => {
      const result = eventCreateSchema.parse({
        title: "T",
        isAllDay: true,
        startDate: "2026-05-17",
        endDate: "2026-05-17",
        description: "Notes here",
      });
      expect(result.description).toBe("Notes here");
    });

    it("treats empty description as undefined", () => {
      const result = eventCreateSchema.parse({
        title: "T",
        isAllDay: true,
        startDate: "2026-05-17",
        endDate: "2026-05-17",
        description: "",
      });
      expect(result.description).toBeUndefined();
    });

    it("accepts color", () => {
      const result = eventCreateSchema.parse({
        title: "T",
        isAllDay: true,
        startDate: "2026-05-17",
        endDate: "2026-05-17",
        color: "rose",
      });
      expect(result.color).toBe("rose");
    });
  });

  describe("reminderOffsetsMinutes", () => {
    it("accepts reminder offsets for timed events", () => {
      const result = eventCreateSchema.parse({
        title: "Call",
        isAllDay: false,
        startLocal: "2026-05-17T09:00",
        endLocal: "2026-05-17T10:00",
        reminderOffsetsMinutes: [15],
      });
      expect(result.reminderOffsetsMinutes).toEqual([15]);
    });

    it("rejects reminder offsets for all-day events", () => {
      expect(() =>
        eventCreateSchema.parse({
          title: "Holiday",
          isAllDay: true,
          startDate: "2026-12-25",
          endDate: "2026-12-25",
          reminderOffsetsMinutes: [15],
        }),
      ).toThrow();
    });
  });
});

describe("eventQuerySchema", () => {
  it("accepts empty object", () => {
    expect(() => eventQuerySchema.parse({})).not.toThrow();
  });

  it("accepts valid from/to date range", () => {
    const result = eventQuerySchema.parse({ from: "2026-05-01", to: "2026-05-31" });
    expect(result.from).toBe("2026-05-01");
    expect(result.to).toBe("2026-05-31");
  });

  it("rejects invalid date format", () => {
    expect(() => eventQuerySchema.parse({ from: "01/05/2026" })).toThrow();
    expect(() => eventQuerySchema.parse({ to: "2026-5-1" })).toThrow();
  });
});
