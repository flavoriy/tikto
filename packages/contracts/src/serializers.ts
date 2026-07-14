type TaskInput = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  dueTime: string | null;
  dueAtUtc: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventInput = {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  isAllDay: boolean;
  startAtUtc: Date | null;
  endAtUtc: Date | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProfileInput = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
};

export function serializeTask<T extends TaskInput>(task: T) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    dueAtUtc: task.dueAtUtc?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function serializeEvent<T extends EventInput>(event: T) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    color: event.color,
    isAllDay: event.isAllDay,
    startAtUtc: event.startAtUtc?.toISOString() ?? null,
    endAtUtc: event.endAtUtc?.toISOString() ?? null,
    startDate: event.startDate,
    endDate: event.endDate,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function serializeProfile<T extends ProfileInput>(profile: T) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    timezone: profile.timezone,
  };
}
