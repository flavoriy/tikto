import { z } from "zod";

export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

export const taskCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(120),
    description: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
    status: taskStatusSchema.default("TODO"),
    priority: taskPrioritySchema.default("MEDIUM"),
    dueDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    dueTime: z.preprocess(emptyToUndefined, z.string().regex(/^\d{2}:\d{2}$/).optional()),
    reminderOffsetsMinutes: z.array(z.number().int().min(1).max(43200)).max(5).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dueTime && !value.dueDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueTime"],
        message: "A due time requires a due date.",
      });
    }

    if (value.reminderOffsetsMinutes?.length && (!value.dueDate || !value.dueTime)) {
      ctx.addIssue({
        code: "custom",
        path: ["reminderOffsetsMinutes"],
        message: "Timed task reminders require both a due date and due time.",
      });
    }
  });

export const taskQuerySchema = z.object({
  view: z.enum(["all", "today", "upcoming", "overdue", "completed"]).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  search: z.string().trim().optional(),
});
