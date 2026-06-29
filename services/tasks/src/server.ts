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
import { createTasksDomain } from "./domain";
import { PrismaClient } from "./generated/prisma";
import { createTasksRepository } from "./repository";

const prisma = createServiceDatabaseClient("tasks-service", "TASKS_DATABASE_URL", ({ datasourceUrl, log }) =>
  new PrismaClient({ datasourceUrl, log }),
);
const domain = createTasksDomain(createTasksRepository(prisma));

createJsonServiceServer({
  serviceName: "tikto-tasks",
  defaultPort: 4200,
  onShutdown: () => prisma.$disconnect(),
  async route({ request, url, pathname, segments, method }) {
    if (method === "GET" && pathname === "/health") {
      const health = await getServiceHealth({
        serviceName: "tikto-tasks",
        prisma,
        databaseEnv: "TASKS_DATABASE_URL",
        ownedTables: ["public.tasks"],
      });
      return ok(health, health.ok ? 200 : 503);
    }

    requireInternalRequest(request);
    const context = requireContext(request);

    if (segments.length === 1 && segments[0] === "tasks") {
      if (method === "GET") {
        return ok(await domain.listTasksForView(context, {
          view: url.searchParams.get("view") ?? undefined,
          status: url.searchParams.get("status") ?? undefined,
          priority: url.searchParams.get("priority") ?? undefined,
          search: url.searchParams.get("search") ?? undefined,
        }));
      }

      if (method === "POST") {
        return ok({ task: await domain.createTask(context, await readJson(request)) }, 201);
      }

      methodNotAllowed();
    }

    if (segments.length === 2 && segments[0] === "tasks") {
      const id = decodeURIComponent(segments[1]);

      if (method === "PATCH") {
        return ok({ task: await domain.updateTask(context, id, await readJson(request)) });
      }

      if (method === "DELETE") {
        await domain.deleteTask(context, id);
        return ok({ deleted: true });
      }

      methodNotAllowed();
    }

    if (segments.length === 3 && segments[0] === "tasks") {
      const id = decodeURIComponent(segments[1]);
      const action = segments[2];

      if (method === "POST" && action === "complete") {
        return ok({ task: await domain.completeTask(context, id) });
      }

      if (method === "POST" && action === "reopen") {
        return ok({ task: await domain.reopenTask(context, id) });
      }

      methodNotAllowed();
    }

    notFound();
  },
});


