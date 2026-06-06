import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { runCalendarSync } from "@/server/services/google-import.service";
import { ok, fail } from "@/lib/api";

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("x-goog-channel-id");
  const resourceState = req.headers.get("x-goog-resource-state");

  // sync message: resource has changed — trigger incremental sync
  if (resourceState !== "sync" && resourceState !== "exists") {
    return ok({ ignored: true });
  }

  if (!channelId) {
    return fail(400, "MISSING_CHANNEL_ID", "x-goog-channel-id header is required");
  }

  const integration = await prisma.googleIntegration.findFirst({
    where: { calendarWatchChannelId: channelId },
  });

  if (!integration) {
    return ok({ ignored: true });
  }

  // Fire incremental sync in background
  void runCalendarSync(integration.userId);

  return ok({ queued: true });
}
