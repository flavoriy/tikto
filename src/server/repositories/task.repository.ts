import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const taskRepository = {
  listByUser(userId: string) {
    return prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }],
    });
  },

  findById(userId: string, id: string) {
    return prisma.task.findFirst({
      where: {
        id,
        userId,
      },
    });
  },

  create(userId: string, data: Omit<Prisma.TaskUncheckedCreateInput, "userId">) {
    return prisma.task.create({
      data: {
        ...data,
        userId,
      },
    });
  },

  update(id: string, data: Prisma.TaskUncheckedUpdateInput) {
    return prisma.task.update({
      where: { id },
      data,
    });
  },
};
