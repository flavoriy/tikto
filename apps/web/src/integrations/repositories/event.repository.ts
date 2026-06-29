import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const eventRepository = {
  listByUser(userId: string) {
    return prisma.event.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: "desc" }],
    });
  },

  findById(userId: string, id: string) {
    return prisma.event.findFirst({
      where: {
        id,
        userId,
      },
    });
  },

  create(userId: string, data: Omit<Prisma.EventUncheckedCreateInput, "userId">) {
    return prisma.event.create({
      data: {
        ...data,
        userId,
      },
    });
  },

  update(id: string, data: Prisma.EventUncheckedUpdateInput) {
    return prisma.event.update({
      where: { id },
      data,
    });
  },
};
