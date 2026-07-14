import "server-only";

import { requireAuthenticatedUser, requireCurrentProfile } from "@/lib/auth/session";
import {
  fetchTiktoApi,
  readTiktoApiData,
} from "@/lib/internal-services/internal";

export type TiktoTask = {
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

export type TiktoEvent = {
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

export type TiktoProfile = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  defaultTaskReminderOffsetsMinutes: number[];
  defaultEventReminderOffsetsMinutes: number[];
};

export type TaskFilters = {
  view: "all" | "today" | "upcoming" | "overdue" | "completed";
  status: string;
  priority: string;
  search: string;
};

export type CalendarData = {
  anchorDate: string;
  range: {
    start: string;
    end: string;
    days: string[];
  };
  view: "month" | "week" | "day";
  events: TiktoEvent[];
  previousDate: string;
  nextDate: string;
};

export type DashboardData = {
  todayKey: string;
  todayTasks: TiktoTask[];
  overdueTasks: TiktoTask[];
  todayEvents: TiktoEvent[];
  summary: {
    dueToday: number;
    eventsToday: number;
    overdueTasks: number;
    completedThisWeek: number;
  };
};

function appendDefinedSearchParam(params: URLSearchParams, key: string, value?: string | null) {
  if (value) {
    params.set(key, value);
  }
}

async function authenticatedHeaders() {
  const user = await requireAuthenticatedUser();
  const profile = await requireCurrentProfile();
  const headers = new Headers();

  headers.set("x-tikto-user-id", user.id);
  headers.set("x-tikto-user-timezone", profile.timezone);

  return headers;
}

async function fetchAuthenticatedTiktoApi(path: string, init: RequestInit = {}) {
  const headers = await authenticatedHeaders();
  const providedHeaders = new Headers(init.headers);

  providedHeaders.forEach((value, key) => {
    headers.set(key, value);
  });

  return fetchTiktoApi(path, {
    ...init,
    headers,
  });
}

export async function getTasksForView(query: {
  view?: string;
  status?: string;
  priority?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  appendDefinedSearchParam(params, "view", query.view);
  appendDefinedSearchParam(params, "status", query.status);
  appendDefinedSearchParam(params, "priority", query.priority);
  appendDefinedSearchParam(params, "search", query.search);

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetchAuthenticatedTiktoApi(`/tasks${suffix}`);

  return readTiktoApiData<{
    filters: TaskFilters;
    tasks: TiktoTask[];
  }>(response);
}

export async function getCalendarForView(query: {
  view?: string;
  date?: string;
}) {
  const params = new URLSearchParams();
  appendDefinedSearchParam(params, "view", query.view);
  appendDefinedSearchParam(params, "date", query.date);

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetchAuthenticatedTiktoApi(`/calendar${suffix}`);

  return readTiktoApiData<CalendarData>(response);
}

export async function getDashboard() {
  const response = await fetchAuthenticatedTiktoApi("/dashboard");
  return readTiktoApiData<DashboardData>(response);
}