import type {
  Athlete,
  Activity,
  WellnessRecord,
  CalendarEvent,
  SportSettings,
  ActivityIntervals,
  SummaryRow,
} from "./intervals-types.js";

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
  body?: unknown, // ponytail: serializer input — JSON.stringify accepts anything, callers pass typed bodies
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
  // ponytail: JSON boundary — the one honest cast, no runtime validation
  return (await res.json()) as T;
}

function athletePath(creds: IntervalsCreds, suffix: string): string {
  return `/athlete/${creds.athleteId}${suffix}`;
}

export function getAthlete(creds: IntervalsCreds) {
  return request<Athlete>(creds, "GET", athletePath(creds, ""));
}

export function listActivities(creds: IntervalsCreds, oldest?: string, newest?: string, limit?: number) {
  const params = new URLSearchParams();
  if (oldest) params.set("oldest", oldest);
  if (newest) params.set("newest", newest);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return request<Activity[]>(creds, "GET", athletePath(creds, `/activities${qs ? `?${qs}` : ""}`));
}

export function getActivity(creds: IntervalsCreds, activityId: string) {
  return request<Activity>(creds, "GET", `/activity/${activityId}`);
}

export function listWellness(creds: IntervalsCreds, oldest?: string, newest?: string) {
  const params = new URLSearchParams();
  if (oldest) params.set("oldest", oldest);
  if (newest) params.set("newest", newest);
  const qs = params.toString();
  return request<WellnessRecord[]>(creds, "GET", athletePath(creds, `/wellness${qs ? `?${qs}` : ""}`));
}

export function listEvents(creds: IntervalsCreds, oldest?: string, newest?: string) {
  const params = new URLSearchParams();
  if (oldest) params.set("oldest", oldest);
  if (newest) params.set("newest", newest);
  const qs = params.toString();
  return request<CalendarEvent[]>(creds, "GET", athletePath(creds, `/events${qs ? `?${qs}` : ""}`));
}

export interface EventInput {
  start_date_local: string;
  name?: string;
  type?: string;
  category?: string;
  description?: string;
  moving_time?: number;
}

function withDefaults(event: EventInput): EventInput {
  return { ...event, category: event.category ?? "WORKOUT" };
}

export function createEvent(creds: IntervalsCreds, event: EventInput) {
  return request<CalendarEvent>(creds, "POST", athletePath(creds, "/events"), withDefaults(event));
}

export function createEvents(creds: IntervalsCreds, events: EventInput[]) {
  // The bulk endpoint (unlike /events) needs a full datetime, so pad bare YYYY-MM-DD dates.
  const payload = events.map((e) => ({
    ...withDefaults(e),
    start_date_local: /^\d{4}-\d{2}-\d{2}$/.test(e.start_date_local)
      ? `${e.start_date_local}T00:00:00`
      : e.start_date_local,
  }));
  return request<CalendarEvent[]>(creds, "POST", athletePath(creds, "/events/bulk"), payload);
}

export function updateEvent(creds: IntervalsCreds, eventId: string, fields: Partial<EventInput>) {
  return request<CalendarEvent>(creds, "PUT", athletePath(creds, `/events/${eventId}`), fields);
}

export function deleteEvent(creds: IntervalsCreds, eventId: string) {
  return request<void>(creds, "DELETE", athletePath(creds, `/events/${eventId}`));
}

export function getSportSettings(creds: IntervalsCreds) {
  return request<SportSettings[]>(creds, "GET", athletePath(creds, "/sport-settings"));
}

export function getActivityIntervals(creds: IntervalsCreds, activityId: string) {
  return request<ActivityIntervals>(creds, "GET", `/activity/${activityId}/intervals`);
}

export function getAthleteCurves(
  creds: IntervalsCreds,
  metric: "power" | "pace" | "hr",
  type?: string,
  newest?: string,
  curves?: string, // comma-separated comparison periods, e.g. "42d,1y" (not durations)
) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (newest) params.set("newest", newest);
  if (curves) params.set("curves", curves);
  const qs = params.toString();
  // ponytail: curves shape is metric-dependent and only passed through to textResult — not modeled
  return request<unknown>(creds, "GET", athletePath(creds, `/${metric}-curves.json${qs ? `?${qs}` : ""}`));
}

// Common wellness fields; any subset can be sent. Full schema has ~46 fields.
export interface WellnessInput {
  weight?: number;
  restingHR?: number;
  hrv?: number;
  sleepSecs?: number;
  sleepQuality?: number;
  fatigue?: number;
  soreness?: number;
  stress?: number;
  mood?: number;
  motivation?: number;
  spO2?: number;
  comments?: string;
}

export function logWellness(creds: IntervalsCreds, date: string, fields: WellnessInput) {
  return request<WellnessRecord>(creds, "PUT", athletePath(creds, `/wellness/${date}`), fields);
}

export function markEventDone(creds: IntervalsCreds, eventId: string) {
  return request<CalendarEvent>(creds, "POST", athletePath(creds, `/events/${eventId}/mark-done`));
}

export function getAthleteSummary(creds: IntervalsCreds, start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  const qs = params.toString();
  return request<SummaryRow[]>(creds, "GET", athletePath(creds, `/athlete-summary.json${qs ? `?${qs}` : ""}`));
}

export function getWeatherForecast(creds: IntervalsCreds) {
  // ponytail: weather blob is passed straight to textResult, never read field-by-field — not modeled
  return request<unknown>(creds, "GET", athletePath(creds, "/weather-forecast"));
}

export interface ActivityUpdate {
  name?: string;
  type?: string;
  description?: string;
}

export function updateActivity(creds: IntervalsCreds, activityId: string, fields: ActivityUpdate) {
  return request<Activity>(creds, "PUT", `/activity/${activityId}`, fields);
}
