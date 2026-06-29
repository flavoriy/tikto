import "server-only";

import { randomUUID } from "node:crypto";

import { handleApiError } from "@/lib/api";
import { requireAuthenticatedUser, requireCurrentProfile } from "@/lib/auth/session";
import { fetchTiktoApi } from "@/lib/internal-services/internal";

async function buildProxyHeaders(request: Request) {
  const user = await requireAuthenticatedUser();
  const profile = await requireCurrentProfile();
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  headers.set("x-request-id", requestId);
  headers.set("x-tikto-user-id", user.id);
  headers.set("x-tikto-user-timezone", profile.timezone);

  if (contentType) {
    headers.set("content-type", contentType);
  }

  return headers;
}

async function getProxyBody(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const body = await request.arrayBuffer();
  return body.byteLength > 0 ? body : undefined;
}

function appendOriginalQuery(request: Request, path: string) {
  const { search } = new URL(request.url);
  return search ? `${path}${search}` : path;
}

async function cloneApiResponse(response: Response) {
  const body = await response.text();
  const headers = new Headers();
  headers.set("content-type", response.headers.get("content-type") ?? "application/json; charset=utf-8");

  return new Response(body, {
    status: response.status,
    headers,
  });
}

export async function proxyTiktoApiRequest(request: Request, path: string) {
  try {
    const response = await fetchTiktoApi(appendOriginalQuery(request, path), {
      method: request.method,
      headers: await buildProxyHeaders(request),
      body: await getProxyBody(request),
    });

    return cloneApiResponse(response);
  } catch (error) {
    return handleApiError(error);
  }
}
