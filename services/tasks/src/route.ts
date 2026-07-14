import {
  getServiceHealth,
  type HealthDatabaseClient,
} from "../../../packages/service-runtime/src/health";
import {
  methodNotAllowed,
  notFound,
  ok,
  readJson,
  requireContext,
  requireInternalRequest,
  type RequestContext,
  type ServiceRoute,
} from "../../../packages/service-runtime/src/http";
import type { TasksDomain } from "./domain";

type RouteInput = Parameters<ServiceRoute>[0];

type AuthenticatedTasksRouteInput = RouteInput & {
  context: RequestContext;
  domain: TasksDomain;
};

export function createTasksRoute(input: {
  domain: TasksDomain;
  prisma: HealthDatabaseClient;
}): ServiceRoute {
  return async (routeInput) => {
    if (isHealthRequest(routeInput)) {
      return getTasksHealth(input.prisma);
    }

    requireInternalRequest(routeInput.request);
    const context = requireContext(routeInput.request);

    return routeAuthenticatedTasks({
      ...routeInput,
      context,
      domain: input.domain,
    });
  };
}

function isHealthRequest(input: RouteInput) {
  return input.method === "GET" && input.pathname === "/health";
}

async function getTasksHealth(prisma: HealthDatabaseClient) {
  const health = await getServiceHealth({
    serviceName: "tikto-tasks",
    prisma,
    databaseEnv: "TASKS_DATABASE_URL",
    ownedTables: ["public.tasks"],
  });

  return ok(health, health.ok ? 200 : 503);
}

async function routeAuthenticatedTasks(input: AuthenticatedTasksRouteInput) {
  if (isTasksCollection(input.segments)) {
    return routeTasksCollection(input);
  }

  if (isTaskItem(input.segments)) {
    return routeTaskItem(input);
  }

  if (isTaskAction(input.segments)) {
    return routeTaskAction(input);
  }

  notFound();
}

function isTasksCollection(segments: string[]) {
  return segments.length === 1 && segments[0] === "tasks";
}

function isTaskItem(segments: string[]) {
  return segments.length === 2 && segments[0] === "tasks";
}

function isTaskAction(segments: string[]) {
  return segments.length === 3 && segments[0] === "tasks";
}

async function routeTasksCollection(input: AuthenticatedTasksRouteInput) {
  if (input.method === "GET") {
    return ok(await input.domain.listTasksForView(input.context, {
      view: input.url.searchParams.get("view") ?? undefined,
      status: input.url.searchParams.get("status") ?? undefined,
      priority: input.url.searchParams.get("priority") ?? undefined,
      search: input.url.searchParams.get("search") ?? undefined,
    }));
  }

  if (input.method === "POST") {
    return ok({ task: await input.domain.createTask(input.context, await readJson(input.request)) }, 201);
  }

  methodNotAllowed();
}

async function routeTaskItem(input: AuthenticatedTasksRouteInput) {
  const id = decodeURIComponent(input.segments[1]);

  if (input.method === "PATCH") {
    return ok({ task: await input.domain.updateTask(input.context, id, await readJson(input.request)) });
  }

  if (input.method === "DELETE") {
    await input.domain.deleteTask(input.context, id);
    return ok({ deleted: true });
  }

  methodNotAllowed();
}

async function routeTaskAction(input: AuthenticatedTasksRouteInput) {
  const id = decodeURIComponent(input.segments[1]);
  const action = input.segments[2];

  if (input.method !== "POST") {
    methodNotAllowed();
  }

  if (action === "complete") {
    return ok({ task: await input.domain.completeTask(input.context, id) });
  }

  if (action === "reopen") {
    return ok({ task: await input.domain.reopenTask(input.context, id) });
  }

  methodNotAllowed();
}
