import { createServiceDatabaseClient } from "../../../packages/service-runtime/src/db";
import { createJsonServiceServer } from "../../../packages/service-runtime/src/http";
import { createTasksDomain } from "./domain";
import { PrismaClient } from "./generated/prisma";
import { createTasksRepository } from "./repository";
import { createTasksRoute } from "./route";

const prisma = createServiceDatabaseClient("tasks-service", "TASKS_DATABASE_URL", ({ datasourceUrl, log }) =>
  new PrismaClient({ datasourceUrl, log }),
);
const domain = createTasksDomain(createTasksRepository(prisma));

createJsonServiceServer({
  serviceName: "tikto-tasks",
  defaultPort: 4200,
  onShutdown: () => prisma.$disconnect(),
  route: createTasksRoute({ domain, prisma }),
});
