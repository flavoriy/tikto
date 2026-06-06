import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

export const eventCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(120),
    description: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
    color: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
    isAllDay: z.boolean(),
    startLocal: z.preprocess(emptyToUndefined, z.string().optional()),
    endLocal: z.preprocess(emptyToUndefined, z.string().optional()),
    startDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    endDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    reminderOffsetsMinutes: z.array(z.number().int().min(1).max(43200)).max(5).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.isAllDay) {
      if (!value.startDate || !value.endDate) {
        ctx.addIssue({
          code: "custom",
          path: ["startDate"],
          message: "All-day events require a start and end date.",
        });
      }

      if (value.reminderOffsetsMinutes?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["reminderOffsetsMinutes"],
          message: "All-day event reminders are not supported.",
        });
      }

      return;
    }

    if (!value.startLocal || !value.endLocal) {
      ctx.addIssue({
        code: "custom",
        path: ["startLocal"],
        message: "Timed events require start and end date-times.",
      });
    }

    if (value.reminderOffsetsMinutes?.length && (!value.startLocal || !value.endLocal)) {
      ctx.addIssue({
        code: "custom",
        path: ["reminderOffsetsMinutes"],
        message: "Timed event reminders require start and end date-times.",
      });
    }
  });

export const eventQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
