import { requireAuthenticatedUser } from "@/lib/auth/session";
import { googleIntegrationRepository } from "@/server/repositories/google-integration.repository";
import { ok, handleApiError } from "@/lib/api";

export async function POST() {
  try {
    const user = await requireAuthenticatedUser();
    await googleIntegrationRepository.delete(user.id);
    return ok({ disconnected: true });
  } catch (err) {
    return handleApiError(err);
  }
}
