#!/usr/bin/env node
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as intervals from "./intervals-client.js";
import type { IntervalsCreds } from "./intervals-client.js";
import { planRace, nextBlock, analyzeForm, analyzeTrainings, todaysWorkout, logToday } from "./prompts.js";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env"), quiet: true });

const defaultApiKey = process.env.INTERVALS_API_KEY;
const defaultAthleteId = process.env.INTERVALS_ATHLETE_ID;

function creds(athleteId?: string): IntervalsCreds {
  if (!defaultApiKey) {
    throw new Error("Missing INTERVALS_API_KEY. Set it in the extension config (or .env).");
  }
  const id = athleteId ?? defaultAthleteId;
  if (!id) {
    throw new Error("Missing athlete id. Set INTERVALS_ATHLETE_ID env var or pass athlete_id.");
  }
  return { apiKey: defaultApiKey, athleteId: id };
}

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const athleteIdParam = z.string().optional().describe("Override athlete id, defaults to INTERVALS_ATHLETE_ID");
const dateParam = z.string().describe("Date in YYYY-MM-DD format");

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const server = new McpServer({ name: "intervals-icu-mcp", version: "1.0.0" });

server.registerTool(
  "get_athlete",
  {
    description: "Get athlete profile and current fitness (CTL/ATL/form/ramp rate).",
    inputSchema: { athlete_id: athleteIdParam },
  },
  async ({ athlete_id }) => textResult(await intervals.getAthlete(creds(athlete_id))),
);

server.registerTool(
  "list_activities",
  {
    description: "List past training activities in a date range, for reviewing training history.",
    inputSchema: {
      oldest: dateParam.optional().describe("Start date, defaults to intervals.icu default range"),
      newest: dateParam.optional().describe("End date, defaults to today"),
      limit: z.number().int().positive().optional().describe("Max number of activities to return"),
      athlete_id: athleteIdParam,
    },
  },
  async ({ oldest, newest, limit, athlete_id }) =>
    textResult(await intervals.listActivities(creds(athlete_id), oldest, newest, limit)),
);

server.registerTool(
  "get_activity",
  {
    description: "Get full details of a single activity by id.",
    inputSchema: { activity_id: z.string(), athlete_id: athleteIdParam },
  },
  async ({ activity_id, athlete_id }) => textResult(await intervals.getActivity(creds(athlete_id), activity_id)),
);

server.registerTool(
  "list_wellness",
  {
    description: "List daily wellness entries (sleep, HRV, resting HR, fatigue) in a date range, for assessing recovery.",
    inputSchema: {
      oldest: dateParam.optional(),
      newest: dateParam.optional(),
      athlete_id: athleteIdParam,
    },
  },
  async ({ oldest, newest, athlete_id }) =>
    textResult(await intervals.listWellness(creds(athlete_id), oldest, newest)),
);

server.registerTool(
  "list_events",
  {
    description: "List calendar events (planned and completed workouts) in a date range.",
    inputSchema: {
      oldest: dateParam.optional(),
      newest: dateParam.optional(),
      athlete_id: athleteIdParam,
    },
  },
  async ({ oldest, newest, athlete_id }) =>
    textResult(await intervals.listEvents(creds(athlete_id), oldest, newest)),
);

server.registerTool(
  "create_event",
  {
    description:
      "Create a planned workout on the intervals.icu calendar. If the athlete has Garmin Connect linked in " +
      "intervals.icu settings, it will sync to their Garmin device automatically - no separate Garmin call needed. " +
      "Use the `description` field with intervals.icu workout syntax for structured workouts, e.g. " +
      "'- 10m warmup Z1\\n- 4x (5m Z4, 3m Z1)\\n- 10m cooldown Z1'.",
    inputSchema: {
      start_date_local: dateParam.describe("Date of the workout, YYYY-MM-DD"),
      name: z.string().optional(),
      type: z.string().optional().describe("e.g. Ride, Run, Swim, Workout"),
      description: z.string().optional().describe("Workout structure in intervals.icu workout syntax"),
      moving_time: z.number().int().positive().optional().describe("Planned duration in seconds"),
      category: z.string().optional().describe("WORKOUT (default) | RACE_A | RACE_B | NOTE"),
      athlete_id: athleteIdParam,
    },
  },
  async ({ athlete_id, ...event }) => textResult(await intervals.createEvent(creds(athlete_id), event)),
);

const eventShape = {
  start_date_local: dateParam.describe("Date of the workout, YYYY-MM-DD"),
  name: z.string().optional(),
  type: z.string().optional().describe("e.g. Ride, Run, Swim, Workout"),
  description: z.string().optional().describe("Workout structure in intervals.icu workout syntax"),
  moving_time: z.number().int().positive().optional().describe("Planned duration in seconds"),
  category: z.string().optional().describe("WORKOUT (default) | RACE_A | RACE_B | NOTE"),
};

server.registerTool(
  "create_events",
  {
    description:
      "Create many planned workouts at once (e.g. a whole training block) in a single call. " +
      "Same fields per event as create_event.",
    inputSchema: {
      events: z.array(z.object(eventShape)).describe("Array of workouts to create"),
      athlete_id: athleteIdParam,
    },
  },
  async ({ events, athlete_id }) => textResult(await intervals.createEvents(creds(athlete_id), events)),
);

server.registerTool(
  "update_event",
  {
    description: "Update an existing calendar event/planned workout.",
    inputSchema: {
      event_id: z.string(),
      start_date_local: dateParam.optional(),
      name: z.string().optional(),
      type: z.string().optional(),
      description: z.string().optional(),
      moving_time: z.number().int().positive().optional(),
      athlete_id: athleteIdParam,
    },
  },
  async ({ event_id, athlete_id, ...fields }) =>
    textResult(await intervals.updateEvent(creds(athlete_id), event_id, fields)),
);

server.registerTool(
  "delete_event",
  {
    description: "Delete a calendar event/planned workout.",
    inputSchema: { event_id: z.string(), athlete_id: athleteIdParam },
  },
  async ({ event_id, athlete_id }) => {
    await intervals.deleteEvent(creds(athlete_id), event_id);
    return textResult({ deleted: event_id });
  },
);

server.registerTool(
  "get_sport_settings",
  {
    description:
      "Get the athlete's sport settings: FTP, threshold pace, LTHR and power/HR/pace training zones per sport. " +
      "Essential context for writing workouts and interpreting activity data.",
    inputSchema: { athlete_id: athleteIdParam },
  },
  async ({ athlete_id }) => textResult(await intervals.getSportSettings(creds(athlete_id))),
);

server.registerTool(
  "get_activity_intervals",
  {
    description: "Get the interval/lap breakdown of an activity (power, HR, pace per interval), to review workout execution vs target.",
    inputSchema: { activity_id: z.string(), athlete_id: athleteIdParam },
  },
  async ({ activity_id, athlete_id }) => textResult(await intervals.getActivityIntervals(creds(athlete_id), activity_id)),
);

server.registerTool(
  "get_athlete_curves",
  {
    description:
      "Get the athlete's best-effort curve (best value for each duration) over a period - a benchmark of fitness. " +
      "metric=power|pace|hr. type (sport, e.g. Ride/Run) is required for power.",
    inputSchema: {
      metric: z.enum(["power", "pace", "hr"]),
      type: z.string().optional().describe("Sport, e.g. Ride, Run, Swim. Required for power."),
      newest: dateParam.optional().describe("End date of the window, defaults to last year"),
      curves: z.string().optional().describe("Comma separated comparison periods, e.g. '42d,1y'. Defaults to last year. Each returns best value per duration."),
      athlete_id: athleteIdParam,
    },
  },
  async ({ metric, type, newest, curves, athlete_id }) =>
    textResult(await intervals.getAthleteCurves(creds(athlete_id), metric, type, newest, curves)),
);

server.registerTool(
  "log_wellness",
  {
    description: "Log/update daily wellness for a date (weight, resting HR, HRV, sleep, fatigue, soreness, mood, etc.). Only sends the fields you provide.",
    inputSchema: {
      date: dateParam,
      weight: z.number().positive().optional().describe("kg"),
      restingHR: z.number().int().positive().optional(),
      hrv: z.number().positive().optional(),
      sleepSecs: z.number().int().positive().optional().describe("Sleep duration in seconds"),
      sleepQuality: z.number().int().min(1).max(4).optional(),
      fatigue: z.number().int().min(1).max(4).optional(),
      soreness: z.number().int().min(1).max(4).optional(),
      stress: z.number().int().min(1).max(4).optional(),
      mood: z.number().int().min(1).max(4).optional(),
      motivation: z.number().int().min(1).max(4).optional(),
      spO2: z.number().optional(),
      comments: z.string().optional(),
      athlete_id: athleteIdParam,
    },
  },
  async ({ date, athlete_id, ...fields }) => textResult(await intervals.logWellness(creds(athlete_id), date, fields)),
);

server.registerTool(
  "mark_event_done",
  {
    description: "Mark a planned calendar workout as completed.",
    inputSchema: { event_id: z.string(), athlete_id: athleteIdParam },
  },
  async ({ event_id, athlete_id }) => textResult(await intervals.markEventDone(creds(athlete_id), event_id)),
);

server.registerTool(
  "get_athlete_summary",
  {
    description: "Get aggregate training stats (load, distance, time) over a period, for weekly/monthly reports.",
    inputSchema: {
      start: dateParam.optional().describe("Oldest date, ISO-8601"),
      end: dateParam.optional().describe("Newest date, ISO-8601"),
      athlete_id: athleteIdParam,
    },
  },
  async ({ start, end, athlete_id }) => textResult(await intervals.getAthleteSummary(creds(athlete_id), start, end)),
);

server.registerTool(
  "get_weather_forecast",
  {
    description: "Get the weather forecast for the athlete's location, for planning outdoor sessions.",
    inputSchema: { athlete_id: athleteIdParam },
  },
  async ({ athlete_id }) => textResult(await intervals.getWeatherForecast(creds(athlete_id))),
);

server.registerTool(
  "update_activity",
  {
    description: "Update a completed activity's name, type or description/notes.",
    inputSchema: {
      activity_id: z.string(),
      name: z.string().optional(),
      type: z.string().optional().describe("e.g. Ride, Run, Swim"),
      description: z.string().optional(),
      athlete_id: athleteIdParam,
    },
  },
  async ({ activity_id, athlete_id, ...fields }) =>
    textResult(await intervals.updateActivity(creds(athlete_id), activity_id, fields)),
);

server.registerPrompt(
  "plan_race",
  {
    description: "Analyze fitness and generate the first periodized training block toward a goal race.",
    argsSchema: {
      sport: z.string().describe("triathlon | running | cycling | swimming"),
      distance: z.string().describe("e.g. 10k, marathon, 70.3, olympic, sprint, 1500m"),
      race_date: z.string().describe("Race date, YYYY-MM-DD"),
      notes: z.string().optional().describe("Available days, injuries, other constraints"),
    },
  },
  async (args) => {
    let ctx = null;
    try {
      const c = creds();
      const [athlete, sportSettings, activities, wellness] = await Promise.all([
        intervals.getAthlete(c),
        intervals.getSportSettings(c),
        intervals.listActivities(c, isoDaysAgo(56), undefined, 60),
        intervals.listWellness(c, isoDaysAgo(21)),
      ]);
      ctx = { athlete, sportSettings, activities, wellness };
    } catch {
      // offline / API error: fall back to the instruction-only prompt (model fetches via tools)
    }
    return planRace(args, ctx);
  },
);

server.registerPrompt(
  "next_block",
  {
    description: "Generate the next training block, adapted to what was actually completed and current form.",
    argsSchema: { notes: z.string().optional().describe("Any updates or constraints") },
  },
  async (args) => {
    let ctx = null;
    try {
      const c = creds();
      const [athlete, sportSettings, activities, wellness, events] = await Promise.all([
        intervals.getAthlete(c),
        intervals.getSportSettings(c),
        intervals.listActivities(c, isoDaysAgo(35), undefined, 40),
        intervals.listWellness(c, isoDaysAgo(21)),
        intervals.listEvents(c, isoDaysAgo(35), isoDaysAgo(-365)),
      ]);
      ctx = { athlete, sportSettings, activities, wellness, events };
    } catch {
      // offline / API error: fall back to the instruction-only prompt
    }
    return nextBlock(args, ctx);
  },
);

server.registerPrompt(
  "analyze_form",
  {
    description: "Concise weekly form check-in (fitness/fatigue/form/recovery). Read-only, no calendar writes.",
    argsSchema: { notes: z.string().optional() },
  },
  async (args) => {
    let ctx = null;
    try {
      const c = creds();
      const [athlete, activities, wellness] = await Promise.all([
        intervals.getAthlete(c),
        intervals.listActivities(c, isoDaysAgo(28), undefined, 30),
        intervals.listWellness(c, isoDaysAgo(21)),
      ]);
      ctx = { athlete, activities, wellness };
    } catch {
      // offline / API error: fall back to the instruction-only prompt
    }
    return analyzeForm(args, ctx);
  },
);

server.registerPrompt(
  "analyze_trainings",
  {
    description:
      "Analyze completed training(s) and give actionable feedback. range: session (last workout, incl. per-interval execution) | week (last 7 days) | month (last 30 days). Read-only, no calendar writes.",
    argsSchema: {
      range: z.enum(["session", "week", "month"]).optional().describe("session | week (default) | month"),
      notes: z.string().optional(),
    },
  },
  async (args) => {
    const range = args.range ?? "week";
    let ctx = null;
    try {
      const c = creds();
      if (range === "session") {
        const acts = await intervals.listActivities(c, isoDaysAgo(60), undefined, 1);
        const last = Array.isArray(acts) ? acts[0] : undefined;
        const activityIntervals =
          last && typeof last.id === "string" ? await intervals.getActivityIntervals(c, last.id) : undefined;
        ctx = { activityDetail: last, activityIntervals };
      } else {
        const days = range === "month" ? 30 : 7;
        const [activities, summary] = await Promise.all([
          intervals.listActivities(c, isoDaysAgo(days), undefined, 100),
          intervals.getAthleteSummary(c, isoDaysAgo(days)),
        ]);
        let lapsById: Record<string, unknown> | undefined;
        if (range === "week") {
          // pre-fetch each session's laps in parallel; month stays on-demand to avoid token bloat
          const acts = Array.isArray(activities) ? activities : [];
          const pairs = await Promise.all(
            acts.map((a: any) =>
              typeof a?.id === "string"
                ? intervals
                    .getActivityIntervals(c, a.id)
                    .then((iv) => [a.id, iv] as const)
                    .catch(() => null)
                : null,
            ),
          );
          lapsById = Object.fromEntries(pairs.filter((p): p is readonly [string, unknown] => p !== null));
        }
        ctx = { detailedActivities: activities, summary, lapsById };
      }
    } catch {
      // offline / API error: fall back to the instruction-only prompt
    }
    return analyzeTrainings({ ...args, range }, ctx);
  },
);

server.registerPrompt(
  "todays_workout",
  {
    description: "What should I do today? Explains today's planned session (or suggests one) in plain language, factoring in form and weather. Read-only.",
    argsSchema: { notes: z.string().optional().describe("Anything about how you feel or your day") },
  },
  async (args) => {
    let ctx = null;
    try {
      const c = creds();
      const today = isoDaysAgo(0);
      const [events, wellness] = await Promise.all([
        intervals.listEvents(c, today, today),
        intervals.listWellness(c, isoDaysAgo(14)),
      ]);
      ctx = { events, wellness };
    } catch {
      // offline / API error: fall back to the instruction-only prompt
    }
    return todaysWorkout(args, ctx);
  },
);

server.registerPrompt(
  "log_today",
  {
    description: "Log today's wellness from a plain-language note, e.g. 'slept 7h, tired, weight 72'. Writes via log_wellness.",
    argsSchema: { notes: z.string().optional().describe("Free text: sleep, weight, how you feel, resting HR, HRV…") },
  },
  async (args) => {
    let ctx = null;
    try {
      const c = creds();
      const today = isoDaysAgo(0);
      ctx = { wellness: await intervals.listWellness(c, today, today) };
    } catch {
      // offline / API error: fall back to the instruction-only prompt
    }
    return logToday(args, ctx);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
