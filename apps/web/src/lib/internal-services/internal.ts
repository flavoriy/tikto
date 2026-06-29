import "server-only";

import { randomUUID } from "node:crypto";

import { AppError } from "@/lib/errors";

const tiktoServiceConfig = {
  profile: {
    env: "TIKTO_PROFILE_API_URL",
  },
  tasks: {
    env: "TIKTO_TASKS_API_URL",
  },
  calendar: {
    env: "TIKTO_CALENDAR_API_URL",
  },
  dashboard: {
    env: "TIKTO_DASHBOARD_API_URL",
  },
} as const;

export type TiktoServiceName = keyof typeof tiktoServiceConfig;

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function normalizeRoutePath(path: string) {
  const normalizedPath = normalizePath(path);
  const suffixIndex = normalizedPath.search(/[?#]/);

  return suffixIndex === -1 ? normalizedPath : normalizedPath.slice(0, suffixIndex);
}

export function getTiktoServiceForPath(path: string): TiktoServiceName {
  const normalizedPath = normalizeRoutePath(path);

  if (normalizedPath === "/profile" || normalizedPath.startsWith("/profile/")) {
    return "profile";
  }

  if (normalizedPath === "/tasks" || normalizedPath.startsWith("/tasks/")) {
    return "tasks";
  }

  if (
    normalizedPath === "/events" ||
    normalizedPath.startsWith("/events/") ||
    normalizedPath === "/calendar" ||
    normalizedPath.startsWith("/calendar/")
  ) {
    return "calendar";
  }

  if (normalizedPath === "/dashboard" || normalizedPath.startsWith("/dashboard/")) {
    return "dashboard";
  }

  throw new AppError(500, "TIKTO_SERVICE_NOT_MAPPED", `No TikTo service is mapped for ${normalizedPath}.`);
}

export function getTiktoServiceTargets() {
  return (Object.entries(tiktoServiceConfig) as Array<[
    TiktoServiceName,
    (typeof tiktoServiceConfig)[TiktoServiceName],
  ]>).map(([service, config]) => {
    const url = process.env[config.env] ?? null;

    return {
      service,
      env: config.env,
      configured: Boolean(url),
      url,
    };
  });
}

export function getTiktoServiceBaseUrl(service: TiktoServiceName) {
  const config = tiktoServiceConfig[service];
  const raw = process.env[config.env];

  if (!raw) {
    throw new AppError(
      500,
      "TIKTO_SERVICE_NOT_CONFIGURED",
      `${config.env} is not configured.`,
    );
  }

  return raw.replace(/\/+$/, "");
}

export function getTiktoApiBaseUrl(path = "/") {
  return getTiktoServiceBaseUrl(getTiktoServiceForPath(path));
}

export function encodeHeaderValue(value: string) {
  return encodeURIComponent(value);
}

export function appendSupabaseUserHeaders(
  headers: Headers,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
) {
  headers.set("x-tikto-user-id", user.id);

  if (user.email) {
    headers.set("x-tikto-user-email", encodeHeaderValue(user.email));
  }

  const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (typeof name === "string" && name) {
    headers.set("x-tikto-user-name", encodeHeaderValue(name));
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  if (typeof avatarUrl === "string" && avatarUrl) {
    headers.set("x-tikto-user-avatar-url", encodeHeaderValue(avatarUrl));
  }

  return headers;
}

export function appendInternalHeaders(headers: Headers) {
  const internalKey = process.env.TIKTO_INTERNAL_API_KEY;

  if (internalKey) {
    headers.set("x-tikto-internal-key", internalKey);
  }

  return headers;
}

export function appendTraceHeaders(headers: Headers) {
  if (!headers.get("x-request-id")) {
    headers.set("x-request-id", randomUUID());
  }

  return headers;
}

export function buildTiktoServiceUrl(service: TiktoServiceName, path: string) {
  return `${getTiktoServiceBaseUrl(service)}${normalizePath(path)}`;
}

export function buildTiktoApiUrl(path: string) {
  return buildTiktoServiceUrl(getTiktoServiceForPath(path), path);
}

export async function fetchTiktoService(service: TiktoServiceName, path: string, init: RequestInit = {}) {
  const headers = appendTraceHeaders(appendInternalHeaders(new Headers(init.headers)));

  return fetch(buildTiktoServiceUrl(service, path), {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });
}

export async function fetchTiktoApi(path: string, init: RequestInit = {}) {
  return fetchTiktoService(getTiktoServiceForPath(path), path, init);
}

export async function readTiktoApiData<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as ApiSuccess<T> | ApiFailure | null;

  if (!response.ok || !body?.success) {
    throw new AppError(
      response.status,
      body?.success === false ? body.error.code : "TIKTO_API_ERROR",
      body?.success === false ? body.error.message : "TikTo API request failed.",
    );
  }

  return body.data;
}