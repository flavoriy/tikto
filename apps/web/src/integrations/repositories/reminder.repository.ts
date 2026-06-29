import "server-only";

import type { Prisma, ReminderStatus, ReminderTargetType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const pendingStatuses: ReminderStatus[] = ["SCHEDULED", "FAILED"];

export const reminderRepository = {
  findById(id: string) {
    return prisma.reminder.findUnique({
      where: { id },
    });
  },

  listPendingByTarget(userId: string, targetType: ReminderTargetType, targetId: string, now = new Date()) {
    return prisma.reminder.findMany({
      where: {
        userId,
        targetType,
        targetId,
        status: {
          in: pendingStatuses,
        },
        canceledAt: null,
        sentAt: null,
        remindAtUtc: {
          gte: now,
        },
      },
      orderBy: [{ remindAtUtc: "asc" }],
    });
  },

  create(userId: string, data: Omit<Prisma.ReminderUncheckedCreateInput, "userId">) {
    return prisma.reminder.create({
      data: {
        ...data,
        userId,
      },
    });
  },

  update(id: string, data: Prisma.ReminderUncheckedUpdateInput) {
    return prisma.reminder.update({
      where: { id },
      data,
    });
  },
};
