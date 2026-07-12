// Prompt templates that guide the model through analysis -> periodized plan -> calendar.
// The planning intelligence is the model's job — these just orchestrate the existing tools.
// Prompts pre-fetch read-only context (athlete/wellness/activities/...) and embed a trimmed
// version so the model starts with the numbers instead of spending turns on tool round-trips.

export interface PromptContext {
  athlete?: unknown;
  activities?: unknown;
  wellness?: unknown;
  sportSettings?: unknown;
  events?: unknown;
  activityDetail?: unknown;
  activityIntervals?: unknown;
  detailedActivities?: unknown;
  lapsById?: unknown; // map activity id -> its get_activity_intervals response (week range)
  summary?: unknown;
}

function userText(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

// --- trimming helpers (data from the API is `unknown`; pick key fields, tolerate missing) ---
const obj = (x: unknown): Record<string, any> => (x && typeof x === "object" ? (x as any) : {});
const arr = (x: unknown): any[] => (Array.isArray(x) ? x : []);
const r1 = (x: unknown): number | undefined => (typeof x === "number" ? Math.round(x * 10) / 10 : undefined);
// seconds -> "h:mm:ss" (>=1h) or "m:ss.s" (<1h, tenths; API is whole seconds so .0)
const fmtDur = (secs: unknown): string | undefined => {
  if (typeof secs !== "number" || !isFinite(secs) || secs < 0) return undefined;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const p2 = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return h > 0 ? `${h}:${p2(m)}:${p2(Math.floor(s))}` : `${m}:${p2(s)}.${Math.floor((s % 1) * 10)}`;
};

function trimWellness(wellness: unknown) {
  const days = arr(wellness);
  if (!days.length) return undefined;
  const pick = (w: any) => {
    const ctl = r1(w.ctl);
    const atl = r1(w.atl);
    return {
      date: w.id,
      ctl,
      atl,
      tsb: ctl != null && atl != null ? r1(ctl - atl) : undefined, // form = fitness - fatigue
      rampRate: r1(w.rampRate),
      restingHR: w.restingHR,
      hrv: w.hrv,
      sleep: fmtDur(w.sleepSecs),
    };
  };
  return { latest: pick(days[days.length - 1]), trend: days.map(pick) };
}

function trimActivities(activities: unknown) {
  const list = arr(activities).map((a: any) => ({
    date: a.start_date_local,
    type: a.type,
    name: a.name,
    duration: fmtDur(a.moving_time),
    load: a.icu_training_load,
    km: typeof a.distance === "number" ? r1(a.distance / 1000) : undefined,
  }));
  return list.length ? list : undefined;
}

function trimAthlete(athlete: unknown) {
  const a = obj(athlete);
  const name = a.name ?? `${a.firstname ?? ""} ${a.lastname ?? ""}`.trim();
  if (!name) return undefined;
  return { name, sex: a.sex, restingHR: a.icu_resting_hr, weightKg: r1(a.icu_weight) };
}

function trimSportSettings(sportSettings: unknown) {
  const list = arr(sportSettings).map((s: any) => ({
    types: s.types,
    ftp: s.ftp,
    indoorFtp: s.indoor_ftp,
    lthr: s.lthr,
    maxHr: s.max_hr,
    thresholdPace: s.threshold_pace,
    paceUnits: s.pace_units,
    powerZones: s.power_zones,
    hrZones: s.hr_zones,
    paceZones: s.pace_zones,
  }));
  return list.length ? list : undefined;
}

function trimActivityDetail(activity: unknown) {
  const a = obj(activity);
  if (!a.id && !a.start_date_local) return undefined;
  return {
    id: a.id, // so the model can call get_activity_intervals for this session's laps
    date: a.start_date_local,
    type: a.type,
    name: a.name,
    duration: fmtDur(a.moving_time),
    km: typeof a.distance === "number" ? r1(a.distance / 1000) : undefined,
    load: a.icu_training_load,
    intensityPct: r1(a.icu_intensity), // IF% = NP / FTP
    np: a.icu_weighted_avg_watts,
    avgW: a.icu_average_watts,
    ftp: a.icu_ftp,
    variabilityIndex: r1(a.icu_variability_index),
    efficiencyFactor: r1(a.icu_efficiency_factor),
    avgHr: a.average_heartrate,
    maxHr: a.max_heartrate,
    avgCadence: r1(a.average_cadence),
    elevGain: a.total_elevation_gain,
    kmh: typeof a.average_speed === "number" ? r1(a.average_speed * 3.6) : undefined,
    trimp: r1(a.trimp),
    feel: a.feel,
    rpe: a.icu_rpe,
  };
}

function trimDetailedActivities(activities: unknown, lapsById?: unknown) {
  const map = obj(lapsById);
  const list = arr(activities)
    .map((a) => {
      const t = trimActivityDetail(a);
      if (t && t.id != null) {
        const laps = trimIntervals(map[t.id as string]);
        if (laps) return { ...t, laps };
      }
      return t;
    })
    .filter((a) => a !== undefined);
  return list.length ? list : undefined;
}

function trimIntervals(activityIntervals: unknown) {
  const list = arr(obj(activityIntervals).icu_intervals).map((i: any) => ({
    label: i.label,
    type: i.type,
    duration: fmtDur(i.moving_time),
    meters: typeof i.distance === "number" ? Math.round(i.distance) : undefined,
    kmh: typeof i.average_speed === "number" ? r1(i.average_speed * 3.6) : undefined, // pace for run/swim laps
    avgW: i.average_watts,
    npW: i.weighted_average_watts,
    intensityPct: r1(i.intensity),
    avgHr: i.average_heartrate,
    maxHr: i.max_heartrate,
    avgCadence: r1(i.average_cadence),
    zone: i.zone,
    decoupling: r1(i.decoupling),
    elevGain: i.total_elevation_gain,
  }));
  return list.length ? list : undefined;
}

function trimSummary(summary: unknown) {
  const list = arr(summary).map((s: any) => ({
    date: s.date,
    count: s.count,
    duration: fmtDur(s.moving_time),
    km: typeof s.distance === "number" ? r1(s.distance / 1000) : undefined,
    load: s.training_load,
    elevGain: s.total_elevation_gain,
    fitness: r1(s.fitness),
    fatigue: r1(s.fatigue),
    form: r1(s.form),
    rampRate: r1(s.rampRate),
  }));
  return list.length ? list : undefined;
}

function trimEvents(events: unknown) {
  const list = arr(events).map((e: any) => ({
    id: e.id,
    date: e.start_date_local,
    name: e.name,
    category: e.category,
    type: e.type,
    duration: fmtDur(e.moving_time),
  }));
  return list.length ? list : undefined;
}

// Builds a labeled JSON context block, or "" if nothing was pre-fetched (offline fallback).
function contextBlock(ctx: PromptContext | null | undefined): string {
  if (!ctx) return "";
  const trimmed = {
    athlete: trimAthlete(ctx.athlete),
    sportSettings: trimSportSettings(ctx.sportSettings),
    form_and_recovery: trimWellness(ctx.wellness),
    recent_activities: trimActivities(ctx.activities),
    calendar_events: trimEvents(ctx.events),
    last_training: trimActivityDetail(ctx.activityDetail),
    last_training_intervals: trimIntervals(ctx.activityIntervals),
    trainings: trimDetailedActivities(ctx.detailedActivities, ctx.lapsById),
    summary: trimSummary(ctx.summary),
  };
  // drop undefined top-level keys so the block only shows what was actually fetched
  const filled = Object.fromEntries(Object.entries(trimmed).filter(([, v]) => v !== undefined));
  if (!Object.keys(filled).length) return "";
  return `PRE-FETCHED CONTEXT (already loaded for you — CTL=fitness, ATL=fatigue, TSB=form; use these instead of re-fetching, only call read tools if you need more detail). Durations (duration/sleep) are pre-formatted as hh:mm:ss, or mm:ss.s under an hour; when a tool returns a raw duration in seconds, show it to the athlete in that same format, never as decimal minutes:
${JSON.stringify(filled, null, 2)}

`;
}

export function planRace(
  args: { sport: string; distance: string; race_date: string; notes?: string },
  ctx?: PromptContext | null,
) {
  const { sport, distance, race_date, notes } = args;
  return userText(
    `You are an expert endurance coach. Build a periodized training plan for the athlete's goal race and put the first block on their intervals.icu calendar.

${contextBlock(ctx)}GOAL: ${sport}, distance "${distance}", race date ${race_date}.
${notes ? `Athlete constraints/notes: ${notes}\n` : ""}
Work through these steps, calling the MCP tools as you go:

1. Read fitness context — mostly in the PRE-FETCHED CONTEXT above (sport settings, recent activities, form/recovery). Only call tools for gaps: get_sport_settings, get_athlete, list_activities, list_wellness. Optional: get_athlete_curves for a best-effort benchmark.
2. From recent_activities: volume, frequency, consistency per sport over the last weeks. Optional: get_athlete_summary for aggregate load/distance/time.
3. From form_and_recovery: current form/ramp rate and the sleep / HRV / resting HR trend.
4. Count the weeks from today to ${race_date} and pick the macro phase (base / build / peak / taper) for the current position in the calendar.
5. Create the race as a goal: create_event with category "RACE_A" on ${race_date}, named after the event.
6. Generate ONLY the first block (3-4 weeks) of periodized sessions for ${sport}/${distance}:
   - Respect the ramp rate; use roughly a 3:1 build-to-recovery week ratio.
   - For triathlon, balance swim / bike / run across the week.
   - Express targets in the athlete's own zones from sportSettings so they carry across devices.
7. Save the whole block in ONE create_events call. Use the intervals.icu workout syntax in each event's description (see the create_event tool description), set type (Ride/Run/Swim/Workout) and moving_time in seconds.
8. Summarize the block and remind the athlete: once you finish this block, run /next_block to generate the next one adapted to how it actually went.`,
  );
}

export function nextBlock(args: { notes?: string }, ctx?: PromptContext | null) {
  const { notes } = args;
  return userText(
    `Continue the athlete's race plan with the next 3-4 week block, adapted to what actually happened.

${contextBlock(ctx)}${notes ? `Athlete notes: ${notes}\n` : ""}
Steps:
1. Compare planned vs. actually completed: calendar_events (planned) vs. recent_activities (done) in the PRE-FETCHED CONTEXT. Optional: get_activity_intervals to check execution of key sessions.
2. From form_and_recovery: recomputed CTL/ATL/form/ramp rate.
3. Find the RACE_A goal in calendar_events to get the race date and weeks remaining (list_events if it's outside the fetched window).
4. Pick the macro phase for the new position and generate the next 3-4 week periodized block toward that date, adjusting load up or down based on real form and completion — not a dead pre-made plan.
5. Save it in ONE create_events call (workout syntax in description, type, moving_time in seconds).
6. Summarize and note when to run /next_block again.`,
  );
}

export function analyzeForm(args: { notes?: string }, ctx?: PromptContext | null) {
  const { notes } = args;
  return userText(
    `Give the athlete a concise weekly form check-in. Do not write anything to the calendar.

${contextBlock(ctx)}${notes ? `Athlete notes: ${notes}\n` : ""}
Read the PRE-FETCHED CONTEXT above (call get_athlete / list_activities / list_wellness only if it's missing):
- form_and_recovery: CTL (fitness), ATL (fatigue), TSB (form), ramp rate, and the sleep / HRV / resting HR trend.
- recent_activities: what they've been doing.
Then give a short read: fitness, fatigue, form, ramp rate, recovery trend, and ONE actionable recommendation for the coming days.`,
  );
}

export function analyzeTrainings(
  args: { range?: "session" | "week" | "month"; notes?: string },
  ctx?: PromptContext | null,
) {
  const range = args.range ?? "week";
  const { notes } = args;
  const scope =
    range === "session"
      ? "the single most recent workout (last_training + last_training_intervals)"
      : `the last ${range === "month" ? "30 days" : "7 days"} (trainings + summary)`;
  return userText(
    `Analyze the athlete's training and give actionable feedback. Read-only — do not write anything to the calendar.

${contextBlock(ctx)}${notes ? `Athlete notes: ${notes}\n` : ""}
Scope: ${scope}.
Using the PRE-FETCHED CONTEXT above (call list_activities / get_activity_intervals / get_athlete_summary only if something is missing):
${
  range === "session"
    ? `- Assess execution of last_training: intensity (intensityPct = IF%), normalized (np) vs average (avgW) power, HR↔power decoupling and variabilityIndex, and how it felt (feel / rpe) vs the numbers.
- Walk the laps in last_training_intervals (each lap = meters, kmh, watts, HR, zone, decoupling): pacing consistency, splits, work vs recovery, fade across the session.
- Was it easy/hard as intended? Any red flags (excessive decoupling, sky-high load, ragged pacing)?`
    : `- Volume and training-load progression, intensity distribution (easy vs hard balance / polarization from each session's intensityPct/load), consistency and frequency per sport across trainings.
- Per-session quality where it stands out (efficiencyFactor, avg/max HR, NP vs avg power) and whether the load matches current fitness/fatigue/form and rampRate from summary.
- Each training's laps/splits are in its "laps" array (meters, kmh, watts, HR, zone) when available — use them to judge pacing and workout execution. If a training has no "laps", call get_activity_intervals with its id.`
}
Finish with 2-3 concrete takeaways and ONE recommendation for the next few days.`,
  );
}

export function todaysWorkout(args: { notes?: string }, ctx?: PromptContext | null) {
  const { notes } = args;
  return userText(
    `Tell the athlete what to do today, in plain language. Read-only — do not write anything to the calendar.

${contextBlock(ctx)}${notes ? `Athlete notes: ${notes}\n` : ""}
Use the PRE-FETCHED CONTEXT above:
- calendar_events: today's planned session(s), if any (call list_events for today only if it's missing).
- form_and_recovery: current CTL (fitness), ATL (fatigue), TSB (form) and the sleep / HRV / resting HR trend.
Then:
- If a session is planned today, explain it simply: what to do, roughly how long/hard, and why it fits today's form. Break the workout structure into plain steps.
- If nothing is planned, suggest a sensible session (or rest) based on form and recovery — one clear recommendation, not a menu.
- For an outdoor session, call get_weather_forecast and factor it in (rain, wind, heat) — e.g. suggest moving it indoors or adjusting timing.
Keep it short and encouraging. No calendar changes.`,
  );
}

export function logToday(args: { notes?: string }, ctx?: PromptContext | null) {
  const { notes } = args;
  return userText(
    `Log the athlete's wellness for TODAY from their free-text note, then confirm.

${contextBlock(ctx)}Athlete note: ${notes ?? "(none given — ask what to log)"}
Steps:
1. Parse the note into wellness fields: weight (kg), restingHR, hrv, sleepSecs (convert hours→seconds), sleepQuality/fatigue/soreness/stress/mood/motivation (1=best … 4=worst), spO2, comments. Only include what the note actually mentions.
2. Today's existing entry (if any) is in form_and_recovery above — you're updating it, so don't wipe fields the note doesn't mention (log_wellness only sends the fields you pass).
3. Call log_wellness with date = today and the parsed fields.
4. Confirm back in one line what you logged. If the note is empty or unclear, ask what to log instead of guessing.`,
  );
}
