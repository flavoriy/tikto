import { createServiceDatabaseClient } from "../../../packages/service-runtime/src/db";
import { AppError } from "../../../packages/service-runtime/src/errors";
import { getServiceHealth } from "../../../packages/service-runtime/src/health";
import {
  createJsonServiceServer,
  methodNotAllowed,
  notFound,
  ok,
  readJson,
  requireContext,
  requireInternalRequest,
} from "../../../packages/service-runtime/src/http";
import { createProfileDomain } from "./domain";
import { PrismaClient } from "./generated/prisma";
import { createProfileRepository } from "./repository";

const prisma = createServiceDatabaseClient("profile-service", "PROFILE_DATABASE_URL", ({ datasourceUrl, log }) =>
  new PrismaClient({ datasourceUrl, log }),
);
const domain = createProfileDomain(createProfileRepository(prisma));

createJsonServiceServer({
  serviceName: "tikto-profile",
  defaultPort: 4100,
  onShutdown: () => prisma.$disconnect(),
  async route({ request, pathname, segments, method }) {
    if (method === "GET" && pathname === "/health") {
      const health = await getServiceHealth({
        serviceName: "tikto-profile",
        prisma,
        databaseEnv: "PROFILE_DATABASE_URL",
        ownedTables: ["public.profiles"],
      });
      return ok(health, health.ok ? 200 : 503);
    }

    requireInternalRequest(request);
    const context = requireContext(request);

    if (segments.length === 1 && segments[0] === "profile") {
      if (method === "GET") {
        const profile = await domain.getOrCreateProfile(context);

        if (!profile) {
          throw new AppError(500, "PROFILE_NOT_FOUND", "Your profile is not ready yet.");
        }

        return ok({ profile });
      }

      if (method === "PATCH") {
        return ok({ profile: await domain.updateProfile(context, await readJson(request)) });
      }

      methodNotAllowed();
    }

    notFound();
  },
});


