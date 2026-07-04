import type { Prisma, PrismaClient } from "../generated/prisma";
import type { ProfileRepository } from "../domain/repository";

export function createProfileRepository(prisma: PrismaClient): ProfileRepository {
  return {
    findById(userId: string) {
      return prisma.profile.findUnique({
        where: {
          id: userId,
        },
      });
    },

    create(data: Prisma.ProfileUncheckedCreateInput) {
      return prisma.profile.create({ data });
    },

    update(userId: string, data: Prisma.ProfileUncheckedUpdateInput) {
      return prisma.profile.update({
        where: {
          id: userId,
        },
        data,
      });
    },
  };
}
