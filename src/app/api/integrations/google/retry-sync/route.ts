import type { NextRequest } from "next/server";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { syncEventToGoogle, syncTaskToGoogle } from "@/server/services/google-sync.service";
import { ok, fail, handleApiError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as { type?: string; id?: string };

    if (!body.type || !body.id) {
      return fail(400, "INVALID_PAYLOAD", "type and id are required.");
    }

    if (body.type === "event") {
      await syncEventToGoogle(user.id, body.id);
    } else if (body.type === "task") {
      await syncTaskToGoogle(user.id, body.id);
    } else {
      return fail(400, "INVALID_TYPE", "type must be 'event' or 'task'.");
    }

    return ok({ retried: true });
  } catch (err) {
    return handleApiError(err);
  }
}
