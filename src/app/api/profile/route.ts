import { handleApiError, ok } from "@/lib/api";
import { requireAuthenticatedUser, requireCurrentProfile } from "@/lib/auth/session";
import { z } from "zod";
import { profileRepository } from "@/server/repositories/profile.repository";

const reminderOffsetsSchema = z.array(z.number().int().min(1).max(43200)).max(5);

const profileSchema = z.object({
  name: z.string().trim().max(80).optional(),
  timezone: z.string().trim().min(1),
  defaultTaskReminderOffsetsMinutes: reminderOffsetsSchema.optional(),
  defaultEventReminderOffsetsMinutes: reminderOffsetsSchema.optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    await requireCurrentProfile();
    const payload = profileSchema.parse(await request.json());
    const profile = await profileRepository.update(user.id, {
      name: payload.name ?? null,
      timezone: payload.timezone,
      defaultTaskReminderOffsetsMinutes: payload.defaultTaskReminderOffsetsMinutes,
      defaultEventReminderOffsetsMinutes: payload.defaultEventReminderOffsetsMinutes,
    });

    return ok({ profile });
  } catch (error) {
    return handleApiError(error);
  }
}
