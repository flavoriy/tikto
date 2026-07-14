import type { Prisma, PrismaClient } from "./generated/prisma";

export function createTasksRepository(prisma: PrismaClient) {
  return {
    listByUser(userId: string) {
      return prisma.task.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: [{ createdAt: "desc" }],
      });
    },

    findByUserAndId(userId: string, id: string) {
      return prisma.task.findFirst({
        where: {
          id,
          userId,
        },
      });
    },

    create(data: Prisma.TaskUncheckedCreateInput) {
      return prisma.task.create({ data });
    },

    update(id: string, data: Prisma.TaskUncheckedUpdateInput) {
      return prisma.task.update({
        where: { id },
        data,
      });
    },
  };
}

export type TasksRepository = ReturnType<typeof createTasksRepository>;

