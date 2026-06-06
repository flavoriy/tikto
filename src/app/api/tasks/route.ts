import { handleApiError, ok } from "@/lib/api";
import { requireAuthenticatedUser, requireCurrentProfile } from "@/lib/auth/session";
import { serializeTask } from "@/lib/serializers";
import { createTask, listTasksForView } from "@/server/services/task.service";

export async function GET(request: Request) {
  try {
    const profile = await requireCurrentProfile();
    const { searchParams } = new URL(request.url);
    const result = await listTasksForView({
      userId: profile.id,
      timezone: profile.timezone,
      query: {
        view: searchParams.get("view") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        priority: searchParams.get("priority") ?? undefined,
        search: searchParams.get("search") ?? undefined,
      },
    });

    return ok({
      filters: result.filters,
      tasks: result.tasks.map(serializeTask),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const profile = await requireCurrentProfile();
    const task = await createTask({
      userId: user.id,
      timezone: profile.timezone,
      payload: await request.json(),
    });

    return ok({ task: serializeTask(task) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
