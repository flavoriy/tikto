import { handleApiError, ok } from "@/lib/api";
import { requireAuthenticatedUser, requireCurrentProfile } from "@/lib/auth/session";
import { serializeTask } from "@/lib/serializers";
import { deleteTask, updateTask } from "@/server/services/task.service";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: TaskRouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const profile = await requireCurrentProfile();
    const { id } = await context.params;
    const task = await updateTask({
      id,
      userId: user.id,
      timezone: profile.timezone,
      payload: await request.json(),
    });

    return ok({ task: serializeTask(task) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: TaskRouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await context.params;
    await deleteTask(user.id, id);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
