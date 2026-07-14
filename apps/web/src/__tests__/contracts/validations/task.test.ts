import { describe, expect, it } from "vitest";

import { taskCreateSchema, taskQuerySchema } from "@contracts/validations/task";

describe("taskCreateSchema", () => {
  describe("title", () => {
    it("accepts a valid title", () => {
      const result = taskCreateSchema.parse({ title: "Buy milk", isAllDay: false });
      expect(result.title).toBe("Buy milk");
    });

    it("trims whitespace from title", () => {
      const result = taskCreateSchema.parse({ title: "  Buy milk  " });
      expect(result.title).toBe("Buy milk");
    });

    it("rejects empty title", () => {
      expect(() => taskCreateSchema.parse({ title: "" })).toThrow();
    });

    it("rejects whitespace-only title", () => {
      expect(() => taskCreateSchema.parse({ title: "   " })).toThrow();
    });

    it("rejects title over 120 characters", () => {
      expect(() => taskCreateSchema.parse({ title: "a".repeat(121) })).toThrow();
    });

    it("accepts title of exactly 120 characters", () => {
      const result = taskCreateSchema.parse({ title: "a".repeat(120) });
      expect(result.title).toHaveLength(120);
    });
  });

  describe("description", () => {
    it("accepts optional description", () => {
      const result = taskCreateSchema.parse({ title: "T", description: "Details" });
      expect(result.description).toBe("Details");
    });

    it("treats empty string description as undefined", () => {
      const result = taskCreateSchema.parse({ title: "T", description: "" });
      expect(result.description).toBeUndefined();
    });

    it("rejects description over 1000 characters", () => {
      expect(() => taskCreateSchema.parse({ title: "T", description: "x".repeat(1001) })).toThrow();
    });
  });

  describe("defaults", () => {
    it("defaults status to TODO", () => {
      expect(taskCreateSchema.parse({ title: "T" }).status).toBe("TODO");
    });

    it("defaults priority to MEDIUM", () => {
      expect(taskCreateSchema.parse({ title: "T" }).priority).toBe("MEDIUM");
    });
  });

  describe("status", () => {
    it("accepts all valid statuses", () => {
      for (const status of ["TODO", "IN_PROGRESS", "DONE"] as const) {
        expect(taskCreateSchema.parse({ title: "T", status }).status).toBe(status);
      }
    });

    it("rejects invalid status", () => {
      expect(() => taskCreateSchema.parse({ title: "T", status: "PENDING" })).toThrow();
    });
  });

  describe("priority", () => {
    it("accepts all valid priorities", () => {
      for (const priority of ["LOW", "MEDIUM", "HIGH"] as const) {
        expect(taskCreateSchema.parse({ title: "T", priority }).priority).toBe(priority);
      }
    });

    it("rejects invalid priority", () => {
      expect(() => taskCreateSchema.parse({ title: "T", priority: "CRITICAL" })).toThrow();
    });
  });

  describe("dueDate / dueTime", () => {
    it("accepts a valid dueDate", () => {
      const result = taskCreateSchema.parse({ title: "T", dueDate: "2026-06-01" });
      expect(result.dueDate).toBe("2026-06-01");
    });

    it("rejects invalid dueDate format", () => {
      expect(() => taskCreateSchema.parse({ title: "T", dueDate: "01-06-2026" })).toThrow();
      expect(() => taskCreateSchema.parse({ title: "T", dueDate: "2026/06/01" })).toThrow();
    });

    it("treats empty dueDate as undefined", () => {
      const result = taskCreateSchema.parse({ title: "T", dueDate: "" });
      expect(result.dueDate).toBeUndefined();
    });

    it("accepts dueTime when dueDate is also set", () => {
      const result = taskCreateSchema.parse({ title: "T", dueDate: "2026-06-01", dueTime: "09:00" });
      expect(result.dueTime).toBe("09:00");
    });

    it("rejects dueTime without dueDate", () => {
      expect(() => taskCreateSchema.parse({ title: "T", dueTime: "09:00" })).toThrow();
    });

    it("treats empty dueTime as undefined", () => {
      const result = taskCreateSchema.parse({ title: "T", dueDate: "2026-06-01", dueTime: "" });
      expect(result.dueTime).toBeUndefined();
    });
  });

  describe("reminderOffsetsMinutes", () => {
    it("accepts reminder offsets for timed tasks", () => {
      const result = taskCreateSchema.parse({
        title: "T",
        dueDate: "2026-06-01",
        dueTime: "09:00",
        reminderOffsetsMinutes: [15, 60],
      });
      expect(result.reminderOffsetsMinutes).toEqual([15, 60]);
    });

    it("rejects reminder offsets for date-only tasks", () => {
      expect(() =>
        taskCreateSchema.parse({
          title: "T",
          dueDate: "2026-06-01",
          reminderOffsetsMinutes: [15],
        }),
      ).toThrow();
    });
  });
});

describe("taskQuerySchema", () => {
  it("accepts empty object", () => {
    expect(() => taskQuerySchema.parse({})).not.toThrow();
  });

  it("accepts valid view values", () => {
    for (const view of ["all", "today", "upcoming", "overdue", "completed"]) {
      expect(taskQuerySchema.parse({ view }).view).toBe(view);
    }
  });

  it("rejects invalid view", () => {
    expect(() => taskQuerySchema.parse({ view: "archive" })).toThrow();
  });

  it("accepts valid status and priority", () => {
    const result = taskQuerySchema.parse({ status: "TODO", priority: "HIGH" });
    expect(result.status).toBe("TODO");
    expect(result.priority).toBe("HIGH");
  });

  it("accepts search string", () => {
    const result = taskQuerySchema.parse({ search: "report" });
    expect(result.search).toBe("report");
  });

  it("trims search whitespace", () => {
    const result = taskQuerySchema.parse({ search: "  report  " });
    expect(result.search).toBe("report");
  });
});
