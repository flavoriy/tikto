import { getTodayKey } from "../../../packages/shared/src/dates/tikto-dates";
import { AppError } from "../../../packages/service-runtime/src/errors";
import type { RequestContext } from "../../../packages/service-runtime/src/http";

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type TaskDto = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  dueTime: string | null;
  dueAtUtc: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type EventDto = {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  isAllDay: boolean;
  startAtUtc: string | null;
  endAtUtc: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type TasksResponse = {
  filters: {
    view: string;
    status: string;
    priority: string;
    search: string;
  };
  tasks: TaskDto[];
};

type EventsResponse = {
  events: EventDto[];
};

function getRequiredServiceBaseUrl(envName: string) {
  const value = process.env[envName];

  if (!value) {
    throw new AppError(500, "SERVICE_NOT_CONFIGURED", `${envName} is not configured.`);
  }

  return stripTrailingSlashes(value);
}


function stripTrailingSlashes(value: string) {
  let end = value.length;

  while (end > 0 && value.codePointAt(end - 1) === 47) {
    end -= 1;
  }

  return value.slice(0, end);
}
function authenticatedHeaders(context: RequestContext) {
  const headers = new Headers();
  headers.set("x-tikto-user-id", context.userId);
  headers.set("x-tikto-user-timezone", context.timezone);

  if (context.email) {
    headers.set("x-tikto-user-email", encodeURIComponent(context.email));
  }

  if (context.name) {
    headers.set("x-tikto-user-name", encodeURIComponent(context.name));
  }

  if (context.avatarUrl) {
    headers.set("x-tikto-user-avatar-url", encodeURIComponent(context.avatarUrl));
  }

  if (context.requestId) {
    headers.set("x-request-id", context.requestId);
  }

  if (context.canary) {
    headers.set("x-canary", context.canary);
  }

  const internalKey = process.env.TIKTO_INTERNAL_API_KEY;
  if (internalKey) {
    headers.set("x-tikto-internal-key", internalKey);
  }

  return headers;
}

async function fetchServiceData<T>(
  serviceName: string,
  baseUrl: string,
  path: string,
  context: RequestContext,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: authenticatedHeaders(context),
  });
  const body = await response.json().catch(() => null) as ApiSuccess<T> | ApiFailure | null;

  if (!response.ok || !body?.success) {
    throw new AppError(
      response.status,
      body?.success === false ? body.error.code : "DEPENDENCY_ERROR",
      body?.success === false
        ? `${serviceName}: ${body.error.message}`
        : `${serviceName} request failed.`,
    );
  }

  return body.data;
}

function completedWithinLastWeek(task: TaskDto, now = Date.now()) {
  if (!task.completedAt) {
    return false;
  }

  return Date.parse(task.completedAt) >= now - 7 * 24 * 60 * 60 * 1000;
}

export function createDashboardDomain() {
  return {
    async getDashboardData(context: RequestContext) {
      const tasksBaseUrl = getRequiredServiceBaseUrl("TIKTO_TASKS_API_URL");
      const calendarBaseUrl = getRequiredServiceBaseUrl("TIKTO_CALENDAR_API_URL");
      const todayKey = getTodayKey(context.timezone);
      const todayEventsParams = new URLSearchParams({
        from: todayKey,
        to: todayKey,
      });

      const [todayTasks, overdueTasks, completedTasks, todayEvents] = await Promise.all([
        fetchServiceData<TasksResponse>("tasks-service", tasksBaseUrl, "/tasks?view=today", context),
        fetchServiceData<TasksResponse>("tasks-service", tasksBaseUrl, "/tasks?view=overdue", context),
        fetchServiceData<TasksResponse>("tasks-service", tasksBaseUrl, "/tasks?view=completed", context),
        fetchServiceData<EventsResponse>(
          "calendar-service",
          calendarBaseUrl,
          `/events?${todayEventsParams.toString()}`,
          context,
        ),
      ]);

      return {
        todayKey,
        todayTasks: todayTasks.tasks,
        overdueTasks: overdueTasks.tasks,
        todayEvents: todayEvents.events,
        summary: {
          dueToday: todayTasks.tasks.length,
          eventsToday: todayEvents.events.length,
          overdueTasks: overdueTasks.tasks.length,
          completedThisWeek: completedTasks.tasks.filter((task) => completedWithinLastWeek(task)).length,
        },
      };
    },
  };
}

export type DashboardDomain = ReturnType<typeof createDashboardDomain>;
