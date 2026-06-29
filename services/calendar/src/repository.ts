import type { Prisma, PrismaClient } from "./generated/prisma";

export function createCalendarRepository(prisma: PrismaClient) {
  return {
    listByUser(userId: string) {
      return prisma.event.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: [{ createdAt: "desc" }],
      });
    },

    findByUserAndId(userId: string, id: string) {
      return prisma.event.findFirst({
        where: {
          id,
          userId,
        },
      });
    },

    create(data: Prisma.EventUncheckedCreateInput) {
      return prisma.event.create({ data });
    },

    update(id: string, data: Prisma.EventUncheckedUpdateInput) {
      return prisma.event.update({
        where: { id },
        data,
      });
    },
  };
}

export type CalendarRepository = ReturnType<typeof createCalendarRepository>;

