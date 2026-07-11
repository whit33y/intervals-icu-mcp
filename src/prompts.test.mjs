// ponytail: single self-check for the trim/embed logic. Run: node src/prompts.test.mjs (after build)
import assert from "node:assert";
import { analyzeForm, planRace, analyzeTrainings } from "../dist/prompts.js";

const ctx = {
  athlete: { name: "Kuba", sex: "M", icu_resting_hr: 48, icu_weight: 72.34 },
  activities: [{ start_date_local: "2026-07-10", type: "Ride", name: "Endurance", moving_time: 3600, icu_training_load: 55, distance: 30123 }],
  wellness: [
    { id: "2026-07-10", ctl: 44.6, atl: 51.1, rampRate: 1.06, restingHR: 48, hrv: 50, sleepSecs: 25200 },
    { id: "2026-07-11", ctl: 45.62, atl: 52.06, rampRate: 1.1, restingHR: 47, hrv: 48, sleepSecs: 25800 },
  ],
};

const text = analyzeForm({}, ctx).messages[0].content.text;
// latest day picked, tsb = ctl - atl (rounded), sleep converted to hours, km from meters
assert.match(text, /"date": "2026-07-11"/, "uses latest wellness day");
assert.match(text, /"ctl": 45.6/, "rounds ctl");
assert.match(text, /"tsb": -6.5/, "tsb = ctl - atl = 45.6 - 52.1");
assert.match(text, /"sleepHrs": 7.2/, "25800s -> 7.2h");
assert.match(text, /"minutes": 60/, "moving_time seconds -> minutes");
assert.match(text, /"km": 30.1/, "distance meters -> km");
assert.match(text, /PRE-FETCHED CONTEXT/, "embeds context block");

// null ctx => offline fallback, no context block, instructions still present
const fb = analyzeForm({}, null).messages[0].content.text;
assert.ok(!fb.includes("already loaded for you"), "no data block when ctx null");
assert.match(fb, /form check-in/, "instructions still present");

// empty arrays => block collapses to nothing
const empty = analyzeForm({}, { athlete: {}, activities: [], wellness: [] }).messages[0].content.text;
assert.ok(!empty.includes("already loaded for you"), "empty data -> no block");

// planRace embeds sport settings thresholds, drops zone-array noise-free fields
const pr = planRace({ sport: "cycling", distance: "100k", race_date: "2026-09-01" },
  { sportSettings: [{ types: ["Ride"], ftp: 298, lthr: 185, threshold_pace: null, max_hr: 190, power_zones: [55,75,90,105,120] }] }
).messages[0].content.text;
assert.match(pr, /"ftp": 298/, "sport settings ftp embedded");
assert.match(pr, /"powerZones"/, "zones embedded");

// analyzeTrainings session: rich single-workout metrics + per-interval trim
const session = analyzeTrainings({ range: "session" }, {
  activityDetail: { id: "i1", start_date_local: "2026-07-11", type: "Ride", name: "Gniezno",
    moving_time: 7210, distance: 63021, icu_training_load: 95, icu_intensity: 68.79,
    icu_weighted_avg_watts: 205, icu_average_watts: 186, icu_ftp: 298, average_speed: 8.75, feel: 1, icu_rpe: 2 },
  activityIntervals: { icu_intervals: [
    { label: "Warmup", type: "WARMUP", moving_time: 600, distance: 150, average_speed: 3.3333, average_watts: 150, weighted_average_watts: 160, intensity: 54, average_heartrate: 120, zone: "Z2", decoupling: 2.1 },
  ] },
}).messages[0].content.text;
assert.match(session, /"intensityPct": 68.8/, "IF% from icu_intensity");
assert.match(session, /"np": 205/, "normalized power");
assert.match(session, /"kmh": 31.5/, "speed m/s -> km/h");
assert.match(session, /"label": "Warmup"/, "interval label embedded");
assert.match(session, /"meters": 150/, "lap distance embedded");
assert.match(session, /"kmh": 12/, "lap speed embedded");
assert.match(session, /the single most recent workout/, "session scope text");

// analyzeTrainings week: summary aggregate embedded, PII dropped
const week = analyzeTrainings({ range: "week" }, {
  detailedActivities: [{ id: "i7", start_date_local: "2026-07-10", type: "Run", name: "Easy", moving_time: 1800,
    icu_training_load: 30, distance: 5000, icu_intensity: 72.5, average_heartrate: 150, icu_weighted_avg_watts: 240 }],
  lapsById: { i7: { icu_intervals: [
    { type: "WORK", moving_time: 300, distance: 1000, average_speed: 3.33, average_heartrate: 148, zone: 1 },
  ] } },
  summary: [{ date: "2026-07-11", count: 4, moving_time: 18000, distance: 120000, training_load: 260,
    fitness: 45.6, fatigue: 52.1, form: -6.5, rampRate: 1.1, email: "secret@x.com", athlete_id: 123 }],
}).messages[0].content.text;
assert.match(week, /"trainings"/, "rich per-activity list embedded");
assert.match(week, /"intensityPct": 72.5/, "per-activity IF% embedded");
assert.match(week, /"avgHr": 150/, "per-activity HR embedded");
assert.match(week, /"laps"/, "per-training laps embedded for week");
assert.match(week, /"meters": 1000/, "lap distance embedded in week training");
assert.match(week, /"form": -6.5/, "summary form embedded");
assert.match(week, /"load": 260/, "summary load embedded");
assert.ok(!week.includes("secret@x.com") && !week.includes("email"), "PII dropped from summary");
assert.match(week, /last 7 days/, "week scope text");

// fallback: no ctx -> no data block, instructions still present
const trFb = analyzeTrainings({ range: "month" }, null).messages[0].content.text;
assert.ok(!trFb.includes("already loaded for you"), "no data block when ctx null");
assert.match(trFb, /last 30 days/, "month scope text in fallback");

console.log("OK");
