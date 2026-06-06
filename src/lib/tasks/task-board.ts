import { getTodayKey, toLocalDateTimeLabel } from "@/lib/dates/taskflow-dates";

export type TaskBoardRecord = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  dueTime: string | null;
  dueAtUtc: string | null;
  completedAt: string | null;
};

export type TaskDueMeta = {
  label: string;
  detail: string;
  tone: "default" | "success" | "warning" | "danger";
  isOverdue: boolean;
};

export function getTaskDueMeta(task: TaskBoardRecord, timezone: string, now = new Date()): TaskDueMeta {
  if (task.status === "DONE") {
    return {
      label: "Done",
      detail: "Completed task",
      tone: "success",
      isOverdue: false,
    };
  }

  const todayKey = getTodayKey(timezone, now);
  const dueAt = task.dueAtUtc ? new Date(task.dueAtUtc) : null;
  const dueLabel = dueAt
    ? `Due ${toLocalDateTimeLabel(dueAt, timezone)}`
    : task.dueDate
      ? `Due ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ""}`
      : "No due date";

  if (dueAt && dueAt.getTime() < now.getTime()) {
    return {
      label: "Overdue",
      detail: dueLabel,
      tone: "danger",
      isOverdue: true,
    };
  }

  if (task.dueDate && task.dueDate < todayKey) {
    return {
      label: "Overdue",
      detail: dueLabel,
      tone: "danger",
      isOverdue: true,
    };
  }

  if (task.dueDate === todayKey) {
    return {
      label: "Today",
      detail: dueLabel,
      tone: "warning",
      isOverdue: false,
    };
  }

  if (task.dueDate && task.dueDate > todayKey) {
    return {
      label: "Upcoming",
      detail: dueLabel,
      tone: "default",
      isOverdue: false,
    };
  }

  return {
    label: "Someday",
    detail: dueLabel,
    tone: "default",
    isOverdue: false,
  };
}

export function getTaskBoardCounts(tasks: TaskBoardRecord[], timezone: string, now = new Date()) {
  return {
    todo: tasks.filter((task) => task.status === "TODO").length,
    inProgress: tasks.filter((task) => task.status === "IN_PROGRESS").length,
    done: tasks.filter((task) => task.status === "DONE").length,
    overdue: tasks.filter((task) => task.status !== "DONE" && getTaskDueMeta(task, timezone, now).isOverdue)
      .length,
  };
}

export function groupTasksByStatus(tasks: TaskBoardRecord[]) {
  return {
    TODO: tasks.filter((task) => task.status === "TODO"),
    IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS"),
    DONE: tasks.filter((task) => task.status === "DONE"),
  };
}
