import type { IncomingMessage } from "node:http";
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
  const rawUrl = process.env[config.env] || config.defaultUrl;
  return rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
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

function buildDestinationUrl(baseUrlString: string, targetPath: string, search: string): string {
  const sanitizedPath = targetPath.replace(/[^a-zA-Z0-9/_-]/g, "");
  const destination = new URL(sanitizedPath + search, baseUrlString);
  const expectedHost = new URL(baseUrlString).host;

  if (destination.host !== expectedHost) {
    throw new AppError(400, "INVALID_PATH", "Destination host mismatch.");
  }

  return destination.toString();
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

async function handleHealthCheck() {
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

function buildPassThroughHeaders(request: IncomingMessage, requestId: string): Headers {
  const headers = new Headers();
  headers.set("x-request-id", requestId);

  const contextHeaders = [
    "x-tikto-user-id",
    "x-tikto-user-timezone",
    "x-tikto-user-email",
    "x-tikto-user-name",
    "x-tikto-user-avatar-url",
  ];

  for (const headerName of contextHeaders) {
    const val = headerValue(request, headerName);
    if (val) {
      headers.set(headerName, val);
    }
  }

  const internalKey = process.env.TIKTO_INTERNAL_API_KEY;
  if (internalKey) {
    headers.set("x-tikto-internal-key", internalKey);
  }

  return headers;
}

type UpstreamEnvelope = {
  success?: boolean;
  data?: unknown;
  error?: { code: string; message: string };
};

async function proxyMicroserviceRequest(
  target: ServiceTarget,
  destinationUrl: string,
  method: string,
  headers: Headers,
  request: IncomingMessage,
) {
  try {
    const bodyData = method === "GET" || method === "HEAD" ? undefined : await readJson(request);
    if (bodyData !== undefined) {
      headers.set("content-type", "application/json");
    }

    const upstreamResponse = await fetch(destinationUrl, {
      method,
      headers,
      body: bodyData !== undefined ? JSON.stringify(bodyData) : undefined,
    });

    const jsonPayload = (await upstreamResponse.json().catch(() => null)) as UpstreamEnvelope | null;
    const isSuccessful = upstreamResponse.ok && Boolean(jsonPayload?.success);

    if (isSuccessful && jsonPayload) {
      return ok(jsonPayload.data, upstreamResponse.status);
    }

    const errorCode = jsonPayload?.error?.code ?? "UPSTREAM_ERROR";
    const errorMessage = jsonPayload?.error?.message ?? `${target} service request failed.`;
    throw new AppError(upstreamResponse.status, errorCode, errorMessage);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown gateway proxy error";
    throw new AppError(502, "BAD_GATEWAY", `API Gateway failed to proxy request to ${target}-service: ${message}`);
  }
}

createJsonServiceServer({
  serviceName: "tikto-gateway",
  defaultPort: 4000,
  async route({ request, requestId, pathname, method, url }) {
    if (method === "GET" && pathname === "/health") {
      return handleHealthCheck();
    }

    const clientIp = headerValue(request, "x-forwarded-for") || "127.0.0.1";
    if (!checkRateLimit(clientIp)) {
      throw new AppError(429, "TOO_MANY_REQUESTS", "API Gateway rate limit exceeded.");
    }

    const routeMatch = resolveTargetForPath(pathname);
    if (!routeMatch) {
      notFound();
    }

    const { target, targetPath } = routeMatch;
    const baseUrlString = resolveTargetUrl(target);
    const destinationUrl = buildDestinationUrl(baseUrlString, targetPath, url.search);
    const headers = buildPassThroughHeaders(request, requestId);

    return proxyMicroserviceRequest(target, destinationUrl, method, headers, request);
  },
});
