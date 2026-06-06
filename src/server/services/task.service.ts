import "server-only";

import { taskQuerySchema, taskCreateSchema } from "@/lib/validations/task";
import { AppError } from "@/lib/errors";
import { taskMatchesView, sortTasks, toUtcFromLocal, type TaskView } from "@/lib/dates/taskflow-dates";
import { taskRepository } from "@/server/repositories/task.repository";
import { syncTaskToGoogle } from "@/server/services/google-sync.service";
import { syncTaskReminders } from "@/server/services/reminder.service";

type TaskListInput = {
  userId: string;
  timezone: string;
  query?: {
    view?: string;
    status?: string;
    priority?: string;
    search?: string;
  };
};

type TaskRecord = Awaited<ReturnType<typeof taskRepository.listByUser>>[number];

export async function listTasksForView({ userId, timezone, query }: TaskListInput) {
  const filters = taskQuerySchema.parse(query ?? {});
  const view = (filters.view ?? "all") as TaskView;
  const allTasks = await taskRepository.listByUser(userId);

  const filtered = allTasks.filter((task) => {
    if (!taskMatchesView(task, view, timezone)) {
      return false;
    }

    if (filters.status && task.status !== filters.status) {
      return false;
    }

    if (filters.priority && task.priority !== filters.priority) {
      return false;
    }

    if (filters.search) {
      const needle = filters.search.toLowerCase();
      const haystack = `${task.title}\n${task.description ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }

    return true;
  });

  return {
    filters: {
      view,
      status: filters.status ?? "",
      priority: filters.priority ?? "",
      search: filters.search ?? "",
    },
    tasks: sortTasks(filtered),
  };
}

type TaskMutationInput = {
  userId: string;
  timezone: string;
  payload: unknown;
};

function buildTaskWritePayload(
  input: ReturnType<typeof taskCreateSchema.parse>,
  timezone: string,
): {
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  dueTime: string | null;
  dueAtUtc: Date | null;
} {
  const dueDate = input.dueDate ?? null;
  const dueTime = input.dueTime ?? null;
  const dueAtUtc = dueDate && dueTime ? toUtcFromLocal(dueDate, dueTime, timezone) : null;

  return {
    title: input.title,
    description: input.description ?? null,
    status: input.status,
    priority: input.priority,
    dueDate,
    dueTime,
    dueAtUtc,
  };
}

export async function createTask({ userId, timezone, payload }: TaskMutationInput) {
  const input = taskCreateSchema.parse(payload);
  const task = await taskRepository.create(userId, buildTaskWritePayload(input, timezone));
  await syncTaskReminders({
    userId,
    task,
    reminderOffsetsMinutes: input.reminderOffsetsMinutes,
  });
  void syncTaskToGoogle(userId, task.id);
  return task;
}

export async function updateTask({ userId, timezone, payload, id }: TaskMutationInput & { id: string }) {
  const existing = await taskRepository.findById(userId, id);

  if (!existing || existing.deletedAt) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
  }

  const input = taskCreateSchema.parse(payload);
  const syncStatus = existing.googleTaskId ? "PENDING_UPDATE" : existing.syncStatus;
  const task = await taskRepository.update(id, { ...buildTaskWritePayload(input, timezone), syncStatus });
  await syncTaskReminders({
    userId,
    task,
    reminderOffsetsMinutes: input.reminderOffsetsMinutes,
  });
  void syncTaskToGoogle(userId, id);
  return task;
}

export async function completeTask(userId: string, id: string) {
  const existing = await taskRepository.findById(userId, id);

  if (!existing || existing.deletedAt) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
  }

  const syncStatus = existing.googleTaskId ? "PENDING_UPDATE" : existing.syncStatus;
  const task = await taskRepository.update(id, {
    status: "DONE",
    completedAt: new Date(),
    syncStatus,
  });
  await syncTaskReminders({
    userId,
    task,
  });
  void syncTaskToGoogle(userId, id);
  return task;
}

export async function reopenTask(userId: string, id: string) {
  const existing = await taskRepository.findById(userId, id);

  if (!existing || existing.deletedAt) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
  }

  const syncStatus = existing.googleTaskId ? "PENDING_UPDATE" : existing.syncStatus;
  const task = await taskRepository.update(id, {
    status: "TODO",
    completedAt: null,
    syncStatus,
  });
  await syncTaskReminders({
    userId,
    task,
  });
  void syncTaskToGoogle(userId, id);
  return task;
}

export async function deleteTask(userId: string, id: string) {
  const existing = await taskRepository.findById(userId, id);

  if (!existing || existing.deletedAt) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
  }

  const task = await taskRepository.update(id, {
    deletedAt: new Date(),
    syncStatus: existing.googleTaskId ? "PENDING_DELETE" : existing.syncStatus,
  });
  await syncTaskReminders({
    userId,
    task,
  });
  if (existing.googleTaskId) {
    void syncTaskToGoogle(userId, id);
  }
  return task;
}

export async function countCompletedThisWeek(userId: string) {
  const tasks = await taskRepository.listByUser(userId);
  return countCompletedThisWeekFromTasks(tasks);
}

export function countCompletedThisWeekFromTasks(
  tasks: Awaited<ReturnType<typeof taskRepository.listByUser>>,
) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return tasks.filter((task) => task.completedAt && task.completedAt.getTime() >= weekAgo).length;
}

export function getOverdueTasks(tasks: TaskRecord[], timezone: string) {
  return tasks.filter((task) => taskMatchesView(task, "overdue", timezone));
}
