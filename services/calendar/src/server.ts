import { createServiceDatabaseClient } from "../../../packages/service-runtime/src/db";
import { createJsonServiceServer } from "../../../packages/service-runtime/src/http";
import { createCalendarDomain } from "./domain";
import { PrismaClient } from "./generated/prisma";
import { createCalendarRepository } from "./repository";
import { createCalendarRoute } from "./route";

const prisma = createServiceDatabaseClient("calendar-service", "CALENDAR_DATABASE_URL", ({ datasourceUrl, log }) =>
  new PrismaClient({ datasourceUrl, log }),
);
const domain = createCalendarDomain(createCalendarRepository(prisma));

createJsonServiceServer({
  serviceName: "tikto-calendar",
  defaultPort: 4300,
  onShutdown: () => prisma.$disconnect(),
  route: createCalendarRoute({ domain, prisma }),
});
