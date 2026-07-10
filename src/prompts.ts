// Prompt templates that guide the model through analysis -> periodized plan -> calendar.
// The planning intelligence is the model's job — these just orchestrate the existing tools.

function userText(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

export function planRace(args: { sport: string; distance: string; race_date: string; notes?: string }) {
  const { sport, distance, race_date, notes } = args;
  return userText(
    `You are an expert endurance coach. Build a periodized training plan for the athlete's goal race and put the first block on their intervals.icu calendar.

GOAL: ${sport}, distance "${distance}", race date ${race_date}.
${notes ? `Athlete constraints/notes: ${notes}\n` : ""}
Work through these steps, calling the MCP tools as you go:

1. Read fitness context:
   - get_sport_settings -> zones and thresholds (FTP / threshold pace / LTHR) for the relevant sport(s).
   - get_athlete -> current CTL (fitness), ATL (fatigue), form/TSB and ramp rate.
   - Optional: get_athlete_curves for a best-effort benchmark.
2. Review recent training with list_activities (last 6-8 weeks): volume, frequency, consistency per sport. Optional: get_athlete_summary for aggregate load/distance/time.
3. Check recovery with list_wellness (last 2-3 weeks): sleep, HRV, resting HR trend.
4. Count the weeks from today to ${race_date} and pick the macro phase (base / build / peak / taper) for the current position in the calendar.
5. Create the race as a goal: create_event with category "RACE_A" on ${race_date}, named after the event.
6. Generate ONLY the first block (3-4 weeks) of periodized sessions for ${sport}/${distance}:
   - Respect the ramp rate; use roughly a 3:1 build-to-recovery week ratio.
   - For triathlon, balance swim / bike / run across the week.
   - Express targets in the athlete's own zones from get_sport_settings so they carry across devices.
7. Save the whole block in ONE create_events call. Use the intervals.icu workout syntax in each event's description (see the create_event tool description), set type (Ride/Run/Swim/Workout) and moving_time in seconds.
8. Summarize the block and remind the athlete: once you finish this block, run /next_block to generate the next one adapted to how it actually went.`,
  );
}

export function nextBlock(args: { notes?: string }) {
  const { notes } = args;
  return userText(
    `Continue the athlete's race plan with the next 3-4 week block, adapted to what actually happened.
${notes ? `Athlete notes: ${notes}\n` : ""}
Steps:
1. list_events + list_activities over the last block -> compare planned vs. actually completed sessions. Optional: get_activity_intervals to check execution of key sessions.
2. get_athlete -> recomputed CTL/ATL/form/ramp rate.
3. Find the RACE_A goal via list_events to get the race date and weeks remaining.
4. Pick the macro phase for the new position and generate the next 3-4 week periodized block toward that date, adjusting load up or down based on real form and completion — not a dead pre-made plan.
5. Save it in ONE create_events call (workout syntax in description, type, moving_time in seconds).
6. Summarize and note when to run /next_block again.`,
  );
}

export function analyzeForm(args: { notes?: string }) {
  const { notes } = args;
  return userText(
    `Give the athlete a concise weekly form check-in. Do not write anything to the calendar.
${notes ? `Athlete notes: ${notes}\n` : ""}
Steps:
1. get_athlete -> CTL (fitness), ATL (fatigue), TSB (form), ramp rate.
2. list_activities (recent) -> what they've been doing.
3. list_wellness (recent) -> recovery trend (sleep, HRV, resting HR).
Then give a short read: fitness, fatigue, form, ramp rate, recovery trend, and ONE actionable recommendation for the coming days.`,
  );
}
