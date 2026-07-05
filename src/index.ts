#!/usr/bin/env node
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as intervals from "./intervals-client.js";
import type { IntervalsCreds } from "./intervals-client.js";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env"), quiet: true });

const defaultApiKey = process.env.INTERVALS_API_KEY;
const defaultAthleteId = process.env.INTERVALS_ATHLETE_ID;

function creds(athleteId?: string): IntervalsCreds {
  if (!defaultApiKey) {
    throw new Error("Missing INTERVALS_API_KEY env var. Set it in your .env file.");
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
      athlete_id: athleteIdParam,
    },
  },
  async ({ athlete_id, ...event }) => textResult(await intervals.createEvent(creds(athlete_id), event)),
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

const transport = new StdioServerTransport();
await server.connect(transport);
