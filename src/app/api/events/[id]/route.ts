import { handleApiError, ok } from "@/lib/api";
import { requireAuthenticatedUser, requireCurrentProfile } from "@/lib/auth/session";
import { serializeEvent } from "@/lib/serializers";
import { deleteEvent, updateEvent } from "@/server/services/event.service";

type EventRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: EventRouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const profile = await requireCurrentProfile();
    const { id } = await context.params;
    const event = await updateEvent({
      id,
      userId: user.id,
      timezone: profile.timezone,
      payload: await request.json(),
    });

    return ok({ event: serializeEvent(event) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: EventRouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await context.params;
    await deleteEvent(user.id, id);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
