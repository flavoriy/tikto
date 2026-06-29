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
import type { CalendarDomain } from "./domain";

type RouteInput = Parameters<ServiceRoute>[0];

type AuthenticatedCalendarRouteInput = RouteInput & {
  context: RequestContext;
  domain: CalendarDomain;
};

export function createCalendarRoute(input: {
  domain: CalendarDomain;
  prisma: HealthDatabaseClient;
}): ServiceRoute {
  return async (routeInput) => {
    if (isHealthRequest(routeInput)) {
      return getCalendarHealth(input.prisma);
    }

    requireInternalRequest(routeInput.request);
    const context = requireContext(routeInput.request);

    return routeAuthenticatedCalendar({
      ...routeInput,
      context,
      domain: input.domain,
    });
  };
}

function isHealthRequest(input: RouteInput) {
  return input.method === "GET" && input.pathname === "/health";
}

async function getCalendarHealth(prisma: HealthDatabaseClient) {
  const health = await getServiceHealth({
    serviceName: "tikto-calendar",
    prisma,
    databaseEnv: "CALENDAR_DATABASE_URL",
    ownedTables: ["public.events"],
  });

  return ok(health, health.ok ? 200 : 503);
}

async function routeAuthenticatedCalendar(input: AuthenticatedCalendarRouteInput) {
  if (isEventsCollection(input.segments)) {
    return routeEventsCollection(input);
  }

  if (isEventItem(input.segments)) {
    return routeEventItem(input);
  }

  if (isCalendarView(input.segments)) {
    return routeCalendarView(input);
  }

  notFound();
}

function isEventsCollection(segments: string[]) {
  return segments.length === 1 && segments[0] === "events";
}

function isEventItem(segments: string[]) {
  return segments.length === 2 && segments[0] === "events";
}

function isCalendarView(segments: string[]) {
  return segments.length === 1 && segments[0] === "calendar";
}

async function routeEventsCollection(input: AuthenticatedCalendarRouteInput) {
  if (input.method === "GET") {
    return ok({
      events: await input.domain.listEventsInRange(input.context, {
        from: input.url.searchParams.get("from") ?? undefined,
        to: input.url.searchParams.get("to") ?? undefined,
      }),
    });
  }

  if (input.method === "POST") {
    return ok({ event: await input.domain.createEvent(input.context, await readJson(input.request)) }, 201);
  }

  methodNotAllowed();
}

async function routeEventItem(input: AuthenticatedCalendarRouteInput) {
  const id = decodeURIComponent(input.segments[1]);

  if (input.method === "PATCH") {
    return ok({ event: await input.domain.updateEvent(input.context, id, await readJson(input.request)) });
  }

  if (input.method === "DELETE") {
    await input.domain.deleteEvent(input.context, id);
    return ok({ deleted: true });
  }

  methodNotAllowed();
}

async function routeCalendarView(input: AuthenticatedCalendarRouteInput) {
  if (input.method === "GET") {
    return ok(await input.domain.getCalendarData(input.context, {
      view: input.url.searchParams.get("view"),
      date: input.url.searchParams.get("date"),
    }));
  }

  methodNotAllowed();
}
