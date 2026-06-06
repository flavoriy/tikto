import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const googleIntegrationRepository = {
  findByUserId(userId: string) {
    return prisma.googleIntegration.findUnique({ where: { userId } });
  },

  upsert(
    userId: string,
    data: {
      googleAccountEmail: string;
      accessTokenEncrypted: string;
      refreshTokenEncrypted: string;
      tokenExpiresAt: Date;
      calendarEnabled?: boolean;
      tasksEnabled?: boolean;
    },
  ) {
    const payload = {
      googleAccountEmail: data.googleAccountEmail,
      accessTokenEncrypted: data.accessTokenEncrypted,
      refreshTokenEncrypted: data.refreshTokenEncrypted,
      tokenExpiresAt: data.tokenExpiresAt,
      calendarEnabled: data.calendarEnabled ?? true,
      tasksEnabled: data.tasksEnabled ?? true,
    };
    return prisma.googleIntegration.upsert({
      where: { userId },
      update: payload,
      create: { userId, ...payload },
    });
  },

  update(userId: string, data: Prisma.GoogleIntegrationUncheckedUpdateInput) {
    return prisma.googleIntegration.update({ where: { userId }, data });
  },

  delete(userId: string) {
    return prisma.googleIntegration.deleteMany({ where: { userId } });
  },
};
