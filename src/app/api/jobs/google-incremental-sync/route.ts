import { requireAuthenticatedUser } from "@/lib/auth/session";
import { runCalendarSync, runTasksSync } from "@/server/services/google-import.service";
import { ok, handleApiError } from "@/lib/api";

export async function POST() {
  try {
    const user = await requireAuthenticatedUser();
    await Promise.all([runCalendarSync(user.id), runTasksSync(user.id)]);
    return ok({ synced: true });
  } catch (err) {
    return handleApiError(err);
  }
}
