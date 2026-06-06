import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const profileRepository = {
  findById(id: string) {
    return prisma.profile.findUnique({
      where: { id },
    });
  },

  update(id: string, data: Prisma.ProfileUncheckedUpdateInput) {
    return prisma.profile.update({
      where: { id },
      data,
    });
  },
};
