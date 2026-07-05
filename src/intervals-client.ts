const BASE_URL = "https://intervals.icu/api/v1";

export interface IntervalsCreds {
  apiKey: string;
  athleteId: string;
}

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64");
}

async function request<T>(
  creds: IntervalsCreds,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: authHeader(creds.apiKey),
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`intervals.icu API ${method} ${path} failed: ${res.status} ${res.statusText} ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function athletePath(creds: IntervalsCreds, suffix: string): string {
  return `/athlete/${creds.athleteId}${suffix}`;
}

export function getAthlete(creds: IntervalsCreds) {
  return request(creds, "GET", athletePath(creds, ""));
}

export function listActivities(creds: IntervalsCreds, oldest?: string, newest?: string, limit?: number) {
  const params = new URLSearchParams();
  if (oldest) params.set("oldest", oldest);
  if (newest) params.set("newest", newest);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return request(creds, "GET", athletePath(creds, `/activities${qs ? `?${qs}` : ""}`));
}

export function getActivity(creds: IntervalsCreds, activityId: string) {
  return request(creds, "GET", `/activity/${activityId}`);
}

export function listWellness(creds: IntervalsCreds, oldest?: string, newest?: string) {
  const params = new URLSearchParams();
  if (oldest) params.set("oldest", oldest);
  if (newest) params.set("newest", newest);
  const qs = params.toString();
  return request(creds, "GET", athletePath(creds, `/wellness${qs ? `?${qs}` : ""}`));
}

export function listEvents(creds: IntervalsCreds, oldest?: string, newest?: string) {
  const params = new URLSearchParams();
  if (oldest) params.set("oldest", oldest);
  if (newest) params.set("newest", newest);
  const qs = params.toString();
  return request(creds, "GET", athletePath(creds, `/events${qs ? `?${qs}` : ""}`));
}

export interface EventInput {
  start_date_local: string;
  name?: string;
  type?: string;
  category?: string;
  description?: string;
  moving_time?: number;
}

export function createEvent(creds: IntervalsCreds, event: EventInput) {
  return request(creds, "POST", athletePath(creds, "/events"), {
    category: "WORKOUT",
    ...event,
  });
}

export function updateEvent(creds: IntervalsCreds, eventId: string, fields: Partial<EventInput>) {
  return request(creds, "PUT", athletePath(creds, `/events/${eventId}`), fields);
}

export function deleteEvent(creds: IntervalsCreds, eventId: string) {
  return request(creds, "DELETE", athletePath(creds, `/events/${eventId}`));
}
