import type { Prisma, Profile } from "../generated/prisma";

export interface ProfileRepository {
  findById(userId: string): Promise<Profile | null>;
  create(data: Prisma.ProfileUncheckedCreateInput): Promise<Profile>;
  update(userId: string, data: Prisma.ProfileUncheckedUpdateInput): Promise<Profile>;
}
