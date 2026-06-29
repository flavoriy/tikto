import type { Prisma, Profile } from "./generated/prisma";
import { z } from "zod";

import { serializeProfile } from "../../../packages/contracts/src/serializers";
import type { RequestContext } from "../../../packages/service-runtime/src/http";
import type { ProfileRepository } from "./repository";

const reminderOffsetsSchema = z.array(z.number().int().min(1).max(43200)).max(5);

const profileUpdateSchema = z.object({
  name: z.string().trim().max(80).optional(),
  timezone: z.string().trim().min(1),
  defaultTaskReminderOffsetsMinutes: reminderOffsetsSchema.optional(),
  defaultEventReminderOffsetsMinutes: reminderOffsetsSchema.optional(),
});

function serializeProfileForApi(profile: Profile | null) {
  if (!profile) {
    return null;
  }

  return {
    ...serializeProfile(profile),
    defaultTaskReminderOffsetsMinutes: profile.defaultTaskReminderOffsetsMinutes,
    defaultEventReminderOffsetsMinutes: profile.defaultEventReminderOffsetsMinutes,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function profileCreateData(context: RequestContext): Prisma.ProfileUncheckedCreateInput {
  return {
    id: context.userId,
    email: context.email ?? "",
    name: context.name ?? context.email?.split("@")[0] ?? "User",
    avatarUrl: context.avatarUrl ?? null,
    timezone: "Asia/Ho_Chi_Minh",
  };
}

export function createProfileDomain(repository: ProfileRepository) {
  return {
    async getOrCreateProfile(context: RequestContext) {
      const existing = await repository.findById(context.userId);

      if (existing) {
        return serializeProfileForApi(existing);
      }

      try {
        const created = await repository.create(profileCreateData(context));
        return serializeProfileForApi(created);
      } catch (error) {
        console.error("[profile-service] Failed to create profile fallback:", error);

        const profile = await repository.findById(context.userId);
        return serializeProfileForApi(profile);
      }
    },

    async updateProfile(context: RequestContext, payload: unknown) {
      const input = profileUpdateSchema.parse(payload);
      const data: Prisma.ProfileUncheckedUpdateInput = {
        name: input.name ?? null,
        timezone: input.timezone,
      };

      if (input.defaultTaskReminderOffsetsMinutes !== undefined) {
        data.defaultTaskReminderOffsetsMinutes = input.defaultTaskReminderOffsetsMinutes;
      }

      if (input.defaultEventReminderOffsetsMinutes !== undefined) {
        data.defaultEventReminderOffsetsMinutes = input.defaultEventReminderOffsetsMinutes;
      }

      const profile = await repository.update(context.userId, data);
      return serializeProfileForApi(profile);
    },
  };
}

export type ProfileDomain = ReturnType<typeof createProfileDomain>;

