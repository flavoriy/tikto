import { getServiceHealth } from "../../../packages/service-runtime/src/health";
import {
  createJsonServiceServer,
  headerValue,
  notFound,
  ok,
  readJson,
} from "../../../packages/service-runtime/src/http";
import { AppError } from "../../../packages/service-runtime/src/errors";

const serviceRoutes = {
  profile: {
    env: "TIKTO_PROFILE_API_URL",
    defaultUrl: "http://localhost:4100",
  },
  tasks: {
    env: "TIKTO_TASKS_API_URL",
    defaultUrl: "http://localhost:4200",
  },
  calendar: {
    env: "TIKTO_CALENDAR_API_URL",
    defaultUrl: "http://localhost:4300",
  },
  dashboard: {
    env: "TIKTO_DASHBOARD_API_URL",
    defaultUrl: "http://localhost:4400",
  },
} as const;

type ServiceTarget = keyof typeof serviceRoutes;

function resolveTargetUrl(target: ServiceTarget): string {
  const config = serviceRoutes[target];
  const url = process.env[config.env] || config.defaultUrl;
  return url.replace(/\/+$/, "");
}

function resolveTargetForPath(pathname: string): { target: ServiceTarget; targetPath: string } | null {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (normalized === "/profile" || normalized.startsWith("/profile/")) {
    return { target: "profile", targetPath: normalized };
  }

  if (normalized === "/tasks" || normalized.startsWith("/tasks/")) {
    return { target: "tasks", targetPath: normalized };
  }

  if (
    normalized === "/events" ||
    normalized.startsWith("/events/") ||
    normalized === "/calendar" ||
    normalized.startsWith("/calendar/")
  ) {
    return { target: "calendar", targetPath: normalized };
  }

  if (normalized === "/dashboard" || normalized.startsWith("/dashboard/")) {
    return { target: "dashboard", targetPath: normalized };
  }

  return null;
}

// Memory Sliding Window Rate Limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 120;

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  entry.count += 1;
  return true;
}

createJsonServiceServer({
  serviceName: "tikto-gateway",
  defaultPort: 4000,
  async route({ request, requestId, pathname, method, url }) {
    // 1. Gateway Health Aggregation Endpoint
    if (method === "GET" && pathname === "/health") {
      const health = await getServiceHealth({
        serviceName: "tikto-gateway",
        dependencies: [
          { service: "profile", env: "TIKTO_PROFILE_API_URL" },
          { service: "tasks", env: "TIKTO_TASKS_API_URL" },
          { service: "calendar", env: "TIKTO_CALENDAR_API_URL" },
          { service: "dashboard", env: "TIKTO_DASHBOARD_API_URL" },
        ],
      });
      return ok({ ...health, gateway: "active", rateLimitMax: MAX_REQUESTS_PER_MINUTE }, health.ok ? 200 : 503);
    }

    // 2. Client Rate Limiter
    const clientIp = headerValue(request, "x-forwarded-for") || "127.0.0.1";
    if (!checkRateLimit(clientIp)) {
      throw new AppError(429, "TOO_MANY_REQUESTS", "API Gateway rate limit exceeded.");
    }

    // 3. Resolve Microservice Target
    const routeMatch = resolveTargetForPath(pathname);
    if (!routeMatch) {
      notFound();
    }

    const { target, targetPath } = routeMatch;
    const baseUrl = resolveTargetUrl(target);
    const destinationUrl = `${baseUrl}${targetPath}${url.search}`;

    // 4. Pass-through Headers
    const headers = new Headers();
    headers.set("x-request-id", requestId);

    const userId = headerValue(request, "x-tikto-user-id");
    if (userId) headers.set("x-tikto-user-id", userId);

    const timezone = headerValue(request, "x-tikto-user-timezone");
    if (timezone) headers.set("x-tikto-user-timezone", timezone);

    const email = headerValue(request, "x-tikto-user-email");
    if (email) headers.set("x-tikto-user-email", email);

    const name = headerValue(request, "x-tikto-user-name");
    if (name) headers.set("x-tikto-user-name", name);

    const avatarUrl = headerValue(request, "x-tikto-user-avatar-url");
    if (avatarUrl) headers.set("x-tikto-user-avatar-url", avatarUrl);

    const internalKey = process.env.TIKTO_INTERNAL_API_KEY;
    if (internalKey) {
      headers.set("x-tikto-internal-key", internalKey);
    }

    // 5. Proxy Call to Microservice
    try {
      const body = method === "GET" || method === "HEAD" ? undefined : await readJson(request);
      if (body !== undefined) {
        headers.set("content-type", "application/json");
      }

      const upstreamResponse = await fetch(destinationUrl, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const jsonPayload = await upstreamResponse.json().catch(() => null) as { success?: boolean; data?: unknown; error?: { code: string; message: string } } | null;

      if (!upstreamResponse.ok || !jsonPayload?.success) {
        const errorCode = jsonPayload && "error" in jsonPayload && jsonPayload.error ? jsonPayload.error.code : "UPSTREAM_ERROR";
        const errorMessage = jsonPayload && "error" in jsonPayload && jsonPayload.error ? jsonPayload.error.message : `${target} service request failed.`;
        throw new AppError(upstreamResponse.status, errorCode, errorMessage);
      }

      return ok(jsonPayload.data, upstreamResponse.status);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Unknown gateway proxy error";
      throw new AppError(502, "BAD_GATEWAY", `API Gateway failed to proxy request to ${target}-service: ${message}`);
    }
  },
});
