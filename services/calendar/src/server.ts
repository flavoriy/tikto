import { createServiceDatabaseClient } from "../../../packages/service-runtime/src/db";
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
import { createCalendarDomain } from "./domain";
import { PrismaClient } from "./generated/prisma";
import { createCalendarRepository } from "./repository";

const prisma = createServiceDatabaseClient("calendar-service", "CALENDAR_DATABASE_URL", ({ datasourceUrl, log }) =>
  new PrismaClient({ datasourceUrl, log }),
);
const domain = createCalendarDomain(createCalendarRepository(prisma));

createJsonServiceServer({
  serviceName: "tikto-calendar",
  defaultPort: 4300,
  onShutdown: () => prisma.$disconnect(),
  async route({ request, url, pathname, segments, method }) {
    if (method === "GET" && pathname === "/health") {
      const health = await getServiceHealth({
        serviceName: "tikto-calendar",
        prisma,
        databaseEnv: "CALENDAR_DATABASE_URL",
        ownedTables: ["public.events"],
      });
      return ok(health, health.ok ? 200 : 503);
    }

    requireInternalRequest(request);
    const context = requireContext(request);

    if (segments.length === 1 && segments[0] === "events") {
      if (method === "GET") {
        return ok({
          events: await domain.listEventsInRange(context, {
            from: url.searchParams.get("from") ?? undefined,
            to: url.searchParams.get("to") ?? undefined,
          }),
        });
      }

      if (method === "POST") {
        return ok({ event: await domain.createEvent(context, await readJson(request)) }, 201);
      }

      methodNotAllowed();
    }

    if (segments.length === 2 && segments[0] === "events") {
      const id = decodeURIComponent(segments[1]);

      if (method === "PATCH") {
        return ok({ event: await domain.updateEvent(context, id, await readJson(request)) });
      }

      if (method === "DELETE") {
        await domain.deleteEvent(context, id);
        return ok({ deleted: true });
      }

      methodNotAllowed();
    }

    if (segments.length === 1 && segments[0] === "calendar") {
      if (method === "GET") {
        return ok(await domain.getCalendarData(context, {
          view: url.searchParams.get("view"),
          date: url.searchParams.get("date"),
        }));
      }

      methodNotAllowed();
    }

    notFound();
  },
});


