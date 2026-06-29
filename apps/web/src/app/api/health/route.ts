import { NextResponse } from "next/server";

import {
  fetchTiktoService,
  getTiktoServiceTargets,
  type TiktoServiceName,
} from "@/lib/internal-services/internal";

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const valuesToRedact = [
    ...getTiktoServiceTargets().map((target) => target.url),
    process.env.TIKTO_INTERNAL_API_KEY,
  ].filter(Boolean) as string[];

  return valuesToRedact.reduce(
    (safeMessage, value) => safeMessage.replaceAll(value, "[redacted]"),
    message,
  );
}

async function checkService(target: ReturnType<typeof getTiktoServiceTargets>[number]) {
  if (!target.configured) {
    return {
      service: target.service,
      ok: false,
      configured: false,
      env: target.env,
      error: `${target.env} is not configured.`,
    };
  }

  try {
    const response = await fetchTiktoService(target.service as TiktoServiceName, "/health");
    const body = await response.json().catch(() => null);
    const apiOk = response.ok && Boolean(body?.success && body.data?.ok);

    return {
      service: target.service,
      ok: apiOk,
      configured: true,
      env: target.env,
      status: response.status,
      data: body?.success ? body.data : body,
    };
  } catch (error) {
    return {
      service: target.service,
      ok: false,
      configured: true,
      env: target.env,
      error: sanitizeError(error),
    };
  }
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const checks = await Promise.all(getTiktoServiceTargets().map(checkService));
  const services = Object.fromEntries(checks.map((check) => [check.service, check]));
  const ok = checks.every((check) => check.ok);

  return NextResponse.json(
    {
      ok,
      checkedAt,
      service: "tikto-web",
      web: {
        ok: true,
      },
      services,
    },
    { status: ok ? 200 : 503 },
  );
}