import "server-only";

const BASE = "https://tasks.googleapis.com/tasks/v1";

// ---------- outbound ----------

type TaskPayload = {
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
};

function buildGoogleTaskBody(payload: TaskPayload) {
  return {
    title: payload.title,
    notes: payload.description ?? undefined,
    due: payload.dueDate ? `${payload.dueDate}T00:00:00.000Z` : undefined,
    status: payload.completed ? "completed" : "needsAction",
  };
}

export async function createGoogleTask(
  accessToken: string,
  tasklistId: string,
  payload: TaskPayload,
): Promise<{ id: string; etag: string }> {
  const res = await fetch(`${BASE}/lists/${encodeURIComponent(tasklistId)}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildGoogleTaskBody(payload)),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Tasks create failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id: string; etag: string };
  return { id: data.id, etag: data.etag };
}

export async function updateGoogleTask(
  accessToken: string,
  tasklistId: string,
  googleTaskId: string,
  payload: TaskPayload,
): Promise<{ id: string; etag: string }> {
  const res = await fetch(
    `${BASE}/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(googleTaskId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: googleTaskId, ...buildGoogleTaskBody(payload) }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Tasks update failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id: string; etag: string };
  return { id: data.id, etag: data.etag };
}

export async function deleteGoogleTask(
  accessToken: string,
  tasklistId: string,
  googleTaskId: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(googleTaskId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.text();
    throw new Error(`Google Tasks delete failed (${res.status}): ${body}`);
  }
}

// ---------- inbound ----------

export type GoogleTasklist = {
  id: string;
  title: string;
  etag: string;
  updated: string;
};

export type GoogleTask = {
  id: string;
  etag: string;
  title: string;
  notes?: string;
  status: "needsAction" | "completed";
  due?: string;
  updated: string;
  deleted?: boolean;
  hidden?: boolean;
};

export async function listGoogleTasklists(accessToken: string): Promise<GoogleTasklist[]> {
  const res = await fetch(`${BASE}/users/@me/lists?maxResults=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Tasklists list failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { items?: GoogleTasklist[] };
  return data.items ?? [];
}

type ListTasksResult = {
  tasks: GoogleTask[];
  nextPageToken?: string;
};

export async function listGoogleTasks(
  accessToken: string,
  tasklistId: string,
  options: {
    updatedMin?: string;
    pageToken?: string;
    showDeleted?: boolean;
    showCompleted?: boolean;
    showHidden?: boolean;
    maxResults?: number;
  } = {},
): Promise<ListTasksResult> {
  const params = new URLSearchParams({
    maxResults: String(options.maxResults ?? 100),
    showDeleted: String(options.showDeleted ?? true),
    showCompleted: String(options.showCompleted ?? true),
    showHidden: String(options.showHidden ?? true),
  });
  if (options.updatedMin) params.set("updatedMin", options.updatedMin);
  if (options.pageToken) params.set("pageToken", options.pageToken);

  const res = await fetch(
    `${BASE}/lists/${encodeURIComponent(tasklistId)}/tasks?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Tasks list failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { items?: GoogleTask[]; nextPageToken?: string };
  return {
    tasks: data.items ?? [],
    nextPageToken: data.nextPageToken,
  };
}
