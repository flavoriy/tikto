import "./bootstrap";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { AppError, toApiError } from "./errors";

export type ApiResult = {
  status?: number;
  data: unknown;
};

export type RequestContext = {
  userId: string;
  timezone: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  canary?: string;
  requestId?: string;
};

export type ServiceRoute = (input: {
  request: IncomingMessage;
  requestId: string;
  url: URL;
  pathname: string;
  segments: string[];
  method: string;
}) => Promise<ApiResult>;

const maxBodyBytes = 1_000_000;

export function headerValue(request: IncomingMessage, name: string) {
  const value = request.headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function decodedHeaderValue(request: IncomingMessage, name: string) {
  const value = headerValue(request, name);

  if (!value) {
    return undefined;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

export function requireInternalRequest(request: IncomingMessage) {
  const configuredKey = process.env.TIKTO_INTERNAL_API_KEY;

  if (!configuredKey) {
    throw new AppError(500, "INTERNAL_SERVER_ERROR", "Internal API key is not configured.");
  }

  const presentedKey = headerValue(request, "x-tikto-internal-key");
  if (!presentedKey || !timingSafeStringEqual(presentedKey, configuredKey)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid internal API key.");
  }
}

export function requireContext(request: IncomingMessage): RequestContext {
  const userId = headerValue(request, "x-tikto-user-id");

  if (!userId) {
    throw new AppError(401, "UNAUTHORIZED", "Missing authenticated user context.");
  }

  return {
    userId,
    timezone: headerValue(request, "x-tikto-user-timezone") ?? "Asia/Ho_Chi_Minh",
    email: decodedHeaderValue(request, "x-tikto-user-email"),
    name: decodedHeaderValue(request, "x-tikto-user-name"),
    avatarUrl: decodedHeaderValue(request, "x-tikto-user-avatar-url"),
    canary: headerValue(request, "x-canary"),
    requestId: headerValue(request, "x-request-id"),
  };
}

export async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > maxBodyBytes) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

function writeJson(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("content-length", Buffer.byteLength(payload));
  response.end(payload);
}

export function ok(data: unknown, status = 200): ApiResult {
  return { status, data };
}

function apiResponse(result: ApiResult) {
  return {
    success: true,
    data: result.data,
  };
}

export function methodNotAllowed(): never {
  throw new AppError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
}

export function notFound(): never {
  throw new AppError(404, "NOT_FOUND", "Route not found.");
}

function shouldLogRequest(pathname: string) {
  const logLevel = (process.env.LOG_LEVEL ?? "info").toLowerCase();

  if (["silent", "off", "none"].includes(logLevel)) {
    return false;
  }

  return pathname !== "/health" || process.env.LOG_HEALTHCHECKS === "true";
}

function stripTrailingSlashes(value: string) {
  let end = value.length;

  while (end > 0 && value.codePointAt(end - 1) === 47) {
    end -= 1;
  }

  return value.slice(0, end);
}

function logLevelForStatus(status: number) {
  if (status >= 500) {
    return "error";
  }

  if (status >= 400) {
    return "warn";
  }

  return "info";
}

function logRequest(input: {
  serviceName: string;
  status: number;
  durationMs: number;
  errorCode?: string;
}) {
  console.log(JSON.stringify({
    level: logLevelForStatus(input.status),
    event: "http_request",
    service: input.serviceName,
    status: input.status,
    durationMs: input.durationMs,
    errorCode: input.errorCode ?? null,
    timestamp: new Date().toISOString(),
  }));
}

export function createJsonServiceServer(input: {
  serviceName: string;
  defaultPort: number;
  route: ServiceRoute;
  onShutdown?: () => Promise<void> | void;
}) {
  const server = createServer(async (request, response) => {
    const requestId = headerValue(request, "x-request-id") ?? randomUUID();
    const startedAt = Date.now();
    const method = request.method ?? "GET";
    let pathname = "/";

    response.setHeader("x-request-id", requestId);

    try {
      const url = new URL(request.url ?? "/", "https://" + input.serviceName + ".local");
      pathname = stripTrailingSlashes(url.pathname) || "/";
      const segments = pathname.split("/").filter(Boolean);
      const result = await input.route({ request, requestId, url, pathname, segments, method });
      const status = result.status ?? 200;

      writeJson(response, status, apiResponse(result));
      if (shouldLogRequest(pathname)) {
        logRequest({
          serviceName: input.serviceName,
          status,
          durationMs: Date.now() - startedAt,
        });
      }
    } catch (error) {
      const failure = toApiError(error);
      writeJson(response, failure.status, failure.body);
      if (shouldLogRequest(pathname)) {
        logRequest({
          serviceName: input.serviceName,
          status: failure.status,
          durationMs: Date.now() - startedAt,
          errorCode: failure.body.error.code,
        });
      }
    }
  });

  const port = Number(process.env.PORT ?? input.defaultPort);
  const hostname = process.env.HOSTNAME ?? "0.0.0.0";

  server.listen(port, hostname, () => {
    console.log(JSON.stringify({
      level: "info",
      event: "service_listening",
      service: input.serviceName,
      hostname,
      port,
      timestamp: new Date().toISOString(),
    }));
  });

  function shutdown(signal: string) {
    console.log(JSON.stringify({
      level: "info",
      event: "service_shutdown",
      service: input.serviceName,
      signal,
      timestamp: new Date().toISOString(),
    }));
    server.close(() => {
      void Promise.resolve(input.onShutdown?.()).finally(() => {
        process.exit(0);
      });
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}
