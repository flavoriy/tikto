import type { Prisma } from "./generated/prisma";

import {
  sortTasks,
  taskMatchesView,
  toUtcFromLocal,
  type TaskView,
} from "../../../packages/shared/src/dates/tikto-dates";
import { serializeTask } from "../../../packages/contracts/src/serializers";
import { taskCreateSchema, taskQuerySchema } from "../../../packages/contracts/src/validations/task";
import { AppError } from "../../../packages/service-runtime/src/errors";
import type { RequestContext } from "../../../packages/service-runtime/src/http";
import type { TasksRepository } from "./repository";

function buildTaskWritePayload(input: ReturnType<typeof taskCreateSchema.parse>, timezone: string) {
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

export function createTasksDomain(repository: TasksRepository) {
  return {
    async listTasksForView(
      context: RequestContext,
      query?: {
        view?: string;
        status?: string;
        priority?: string;
        search?: string;
      },
    ) {
      const filters = taskQuerySchema.parse(query ?? {});
      const view = (filters.view ?? "all") as TaskView;
      const allTasks = await repository.listByUser(context.userId);

      const filtered = allTasks.filter((task) => {
        if (!taskMatchesView(task, view, context.timezone)) {
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
        tasks: sortTasks(filtered).map(serializeTask),
      };
    },

    async createTask(context: RequestContext, payload: unknown) {
      const input = taskCreateSchema.parse(payload);
      const task = await repository.create({
        ...buildTaskWritePayload(input, context.timezone),
        userId: context.userId,
      });

      return serializeTask(task);
    },

    async updateTask(context: RequestContext, id: string, payload: unknown) {
      const existing = await repository.findByUserAndId(context.userId, id);

      if (!existing || existing.deletedAt) {
        throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
      }

      const input = taskCreateSchema.parse(payload);
      const syncStatus = existing.googleTaskId ? "PENDING_UPDATE" : existing.syncStatus;
      const data: Prisma.TaskUncheckedUpdateInput = {
        ...buildTaskWritePayload(input, context.timezone),
        syncStatus,
      };
      const task = await repository.update(id, data);

      return serializeTask(task);
    },

    async completeTask(context: RequestContext, id: string) {
      const existing = await repository.findByUserAndId(context.userId, id);

      if (!existing || existing.deletedAt) {
        throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
      }

      const task = await repository.update(id, {
        status: "DONE",
        completedAt: new Date(),
        syncStatus: existing.googleTaskId ? "PENDING_UPDATE" : existing.syncStatus,
      });

      return serializeTask(task);
    },

    async reopenTask(context: RequestContext, id: string) {
      const existing = await repository.findByUserAndId(context.userId, id);

      if (!existing || existing.deletedAt) {
        throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
      }

      const task = await repository.update(id, {
        status: "TODO",
        completedAt: null,
        syncStatus: existing.googleTaskId ? "PENDING_UPDATE" : existing.syncStatus,
      });

      return serializeTask(task);
    },

    async deleteTask(context: RequestContext, id: string) {
      const existing = await repository.findByUserAndId(context.userId, id);

      if (!existing || existing.deletedAt) {
        throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
      }

      await repository.update(id, {
        deletedAt: new Date(),
        syncStatus: existing.googleTaskId ? "PENDING_DELETE" : existing.syncStatus,
      });
    },
  };
}

export type TasksDomain = ReturnType<typeof createTasksDomain>;

