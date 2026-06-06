import { describe, expect, it } from "vitest";

import { getTaskBoardCounts, getTaskDueMeta, groupTasksByStatus, type TaskBoardRecord } from "@/lib/tasks/task-board";

const baseTask: TaskBoardRecord = {
  id: "task-1",
  title: "Write release notes",
  description: null,
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "2026-05-17",
  dueTime: "09:30",
  dueAtUtc: "2026-05-17T02:30:00.000Z",
  completedAt: null,
};

describe("task-board helpers", () => {
  it("marks past due open tasks as overdue", () => {
    const result = getTaskDueMeta(baseTask, "Asia/Ho_Chi_Minh", new Date("2026-05-17T04:00:00.000Z"));

    expect(result).toMatchObject({
      label: "Overdue",
      tone: "danger",
      isOverdue: true,
    });
  });

  it("treats completed tasks as done instead of overdue", () => {
    const result = getTaskDueMeta(
      {
        ...baseTask,
        status: "DONE",
        completedAt: "2026-05-17T05:00:00.000Z",
      },
      "Asia/Ho_Chi_Minh",
      new Date("2026-05-17T06:00:00.000Z"),
    );

    expect(result).toMatchObject({
      label: "Done",
      tone: "success",
      isOverdue: false,
    });
  });

  it("builds summary counts and groups by status", () => {
    const tasks: TaskBoardRecord[] = [
      baseTask,
      {
        ...baseTask,
        id: "task-2",
        status: "IN_PROGRESS",
        dueDate: "2026-05-18",
        dueAtUtc: "2026-05-18T03:00:00.000Z",
      },
      {
        ...baseTask,
        id: "task-3",
        status: "DONE",
        completedAt: "2026-05-17T05:00:00.000Z",
      },
    ];

    expect(getTaskBoardCounts(tasks, "Asia/Ho_Chi_Minh", new Date("2026-05-17T04:00:00.000Z"))).toEqual({
      todo: 1,
      inProgress: 1,
      done: 1,
      overdue: 1,
    });

    expect(groupTasksByStatus(tasks)).toEqual({
      TODO: [tasks[0]],
      IN_PROGRESS: [tasks[1]],
      DONE: [tasks[2]],
    });
  });
});
