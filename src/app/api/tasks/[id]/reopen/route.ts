import { handleApiError, ok } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { serializeTask } from "@/lib/serializers";
import { reopenTask } from "@/server/services/task.service";

type TaskReopenRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: TaskReopenRouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await context.params;
    const task = await reopenTask(user.id, id);
    return ok({ task: serializeTask(task) });
  } catch (error) {
    return handleApiError(error);
  }
}
