import "server-only";

import { taskRepository } from "@/server/repositories/task.repository";
import { eventRepository } from "@/server/repositories/event.repository";
import { countCompletedThisWeekFromTasks, getOverdueTasks } from "@/server/services/task.service";
import { eventOccursOnDate, taskMatchesView, getTodayKey } from "@/lib/dates/taskflow-dates";

export async function getDashboardData(userId: string, timezone: string) {
  const [tasks, events] = await Promise.all([
    taskRepository.listByUser(userId),
    eventRepository.listByUser(userId),
  ]);

  const todayKey = getTodayKey(timezone);
  const todayTasks = tasks.filter((task) => taskMatchesView(task, "today", timezone));
  const overdueTasks = getOverdueTasks(tasks, timezone);
  const todayEvents = events.filter((event) => eventOccursOnDate(event, todayKey, timezone));
  const completedThisWeek = countCompletedThisWeekFromTasks(tasks);

  return {
    todayKey,
    todayTasks,
    overdueTasks,
    todayEvents,
    summary: {
      dueToday: todayTasks.length,
      eventsToday: todayEvents.length,
      overdueTasks: overdueTasks.length,
      completedThisWeek,
    },
  };
}
