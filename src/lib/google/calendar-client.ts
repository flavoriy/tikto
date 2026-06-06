import "server-only";

const BASE = "https://www.googleapis.com/calendar/v3";

export const COLOR_MAP: Record<string, string> = {
  teal: "7",
  amber: "5",
  rose: "11",
  indigo: "9",
  green: "10",
  lavender: "1",
  sage: "2",
  grape: "3",
  flamingo: "4",
  tangerine: "6",
  graphite: "8",
};

export const COLOR_MAP_REVERSE: Record<string, string> = {
  "1": "lavender",
  "2": "sage",
  "3": "grape",
  "4": "flamingo",
  "5": "amber",
  "6": "tangerine",
  "7": "teal",
  "8": "graphite",
  "9": "indigo",
  "10": "green",
  "11": "rose",
};

export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- outbound types ----------

type AllDayEventPayload = {
  isAllDay: true;
  title: string;
  description: string | null;
  color: string | null;
  startDate: string;
  endDate: string;
};

type TimedEventPayload = {
  isAllDay: false;
  title: string;
  description: string | null;
  color: string | null;
  startAtUtc: Date;
  endAtUtc: Date;
  timezone: string;
};

type EventPayload = AllDayEventPayload | TimedEventPayload;

function buildGoogleEventBody(payload: EventPayload) {
  const colorId = payload.color ? (COLOR_MAP[payload.color] ?? undefined) : undefined;
  const base = {
    summary: payload.title,
    description: payload.description ?? undefined,
    colorId,
  };

  if (payload.isAllDay) {
    return {
      ...base,
      start: { date: payload.startDate },
      end: { date: shiftDate(payload.endDate, 1) },
    };
  }

  return {
    ...base,
    start: { dateTime: payload.startAtUtc.toISOString(), timeZone: payload.timezone },
    end: { dateTime: payload.endAtUtc.toISOString(), timeZone: payload.timezone },
  };
}

// ---------- outbound: write ----------

export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  payload: EventPayload,
): Promise<{ id: string; etag: string }> {
  const res = await fetch(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildGoogleEventBody(payload)),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar create failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id: string; etag: string };
  return { id: data.id, etag: data.etag };
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string,
  payload: EventPayload,
): Promise<{ id: string; etag: string }> {
  const res = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGoogleEventBody(payload)),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar update failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id: string; etag: string };
  return { id: data.id, etag: data.etag };
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.text();
    throw new Error(`Google Calendar delete failed (${res.status}): ${body}`);
  }
}

// ---------- inbound: read ----------

export type GoogleCalendarEvent = {
  id: string;
  etag: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  colorId?: string;
  updated: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
};

type ListEventsResult = {
  events: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

export async function listGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  options: {
    syncToken?: string;
    pageToken?: string;
    timeMin?: string;
    maxResults?: number;
  } = {},
): Promise<ListEventsResult> {
  const params = new URLSearchParams({ maxResults: String(options.maxResults ?? 250) });
  if (options.syncToken) params.set("syncToken", options.syncToken);
  if (options.pageToken) params.set("pageToken", options.pageToken);
  if (options.timeMin && !options.syncToken) params.set("timeMin", options.timeMin);
  if (!options.syncToken) params.set("singleEvents", "true");

  const res = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (res.status === 410) {
    throw new SyncTokenExpiredError();
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar list failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    items?: GoogleCalendarEvent[];
    nextPageToken?: string;
    nextSyncToken?: string;
  };

  return {
    events: data.items ?? [],
    nextPageToken: data.nextPageToken,
    nextSyncToken: data.nextSyncToken,
  };
}

export class SyncTokenExpiredError extends Error {
  constructor() {
    super("Google Calendar sync token expired (410 Gone)");
    this.name = "SyncTokenExpiredError";
  }
}

export async function startGoogleCalendarWatch(
  accessToken: string,
  calendarId: string,
  channelId: string,
  webhookUrl: string,
): Promise<{ resourceId: string; expiration: string }> {
  const res = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar watch failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { resourceId: string; expiration: string };
  return { resourceId: data.resourceId, expiration: data.expiration };
}

export async function stopGoogleCalendarWatch(
  accessToken: string,
  channelId: string,
  resourceId: string,
): Promise<void> {
  const res = await fetch(`${BASE}/channels/stop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: channelId, resourceId }),
  });

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.text();
    throw new Error(`Google Calendar watch stop failed (${res.status}): ${body}`);
  }
}
