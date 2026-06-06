import { handleApiError, ok } from "@/lib/api";
import { requireAuthenticatedUser, requireCurrentProfile } from "@/lib/auth/session";
import { serializeEvent } from "@/lib/serializers";
import { createEvent, listEventsInRange } from "@/server/services/event.service";

export async function GET(request: Request) {
  try {
    const profile = await requireCurrentProfile();
    const { searchParams } = new URL(request.url);
    const events = await listEventsInRange({
      userId: profile.id,
      timezone: profile.timezone,
      query: {
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
      },
    });

    return ok({ events: events.map(serializeEvent) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const profile = await requireCurrentProfile();
    const event = await createEvent({
      userId: user.id,
      timezone: profile.timezone,
      payload: await request.json(),
    });

    return ok({ event: serializeEvent(event) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
