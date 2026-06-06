import { requireAuthenticatedUser } from "@/lib/auth/session";
import { bootstrapGoogleImport } from "@/server/services/google-import.service";
import { ok, handleApiError } from "@/lib/api";

export async function POST() {
  try {
    const user = await requireAuthenticatedUser();
    const result = await bootstrapGoogleImport(user.id);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
