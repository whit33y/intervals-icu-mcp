# intervals.icu MCP Server

MCP server wrapping the [intervals.icu](https://intervals.icu) API: review training history, plan workouts, and add them to your calendar. If you've linked Garmin Connect in your intervals.icu account settings (Settings → Garmin), planned workouts you create here sync to your Garmin device automatically — no separate Garmin integration needed.

## Get your intervals.icu account & credentials

1. **Create an account** — go to [intervals.icu](https://www.intervals.icu/), click **Sign up free**, and finish onboarding.
2. **Connect Garmin** (so activities import and planned workouts sync to your device) — **Settings → Connections → Garmin**, log in, and grant **all permissions**.
3. **Get your API key & athlete id** — **Settings → Developer**. Copy the **API Key** and your **Athlete ID** (shown on that page, format `i123456`). These are the two values that go in your `.env` / the install form.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your own credentials:

```
INTERVALS_API_KEY=your_api_key_here   # intervals.icu Settings -> Developer
INTERVALS_ATHLETE_ID=i00000           # your athlete id, e.g. i632406
```

Build:

```bash
npm run build
```

## Use with Claude Code / Claude Desktop

Add to your MCP config (`claude mcp add` or the client's `mcpServers` JSON):

```json
{
  "mcpServers": {
    "intervals-icu": {
      "command": "node",
      "args": ["/absolute/path/to/intervals-icu-mcp/dist/index.js"]
    }
  }
}
```

Each person using this reuses the same code and just sets their own `.env` with their own API key/athlete id.

## One-click install for non-technical users (.mcpb)

Claude Desktop can install this as a bundle (MCPB, formerly "Desktop Extensions"). The user
double-clicks a `.mcpb` file, gets a **settings form**, pastes their API key + athlete id, and Claude
Desktop injects them as env vars — no cloning, no `.env`, no JSON editing.

Build the bundle once:

```bash
npm run pack        # build → prod install → produces intervals-icu-mcp.mcpb
```

Then share the `intervals-icu-mcp.mcpb` file. Config lives in `manifest.json` (`user_config` → `env` mapping).

**Install the extension:**

1. Open Claude Desktop
2. **Settings → Extensions → Advanced settings**
3. **Install extension** → pick the `intervals-icu-mcp.mcpb` file → **Install**
4. Paste your API key + athlete id in the form
5. **Enable** the extension
6. Allow permissions when prompted

**Use it in a chat:**

1. Click **+** in the chat box
2. **Connectors → Add from intervals-icu**
3. Select a skill / tool

<!--
  Alternative distribution — publish to npm (public) instead of sharing a .mcpb.
  Then users add this to their MCP config (no clone/build/absolute paths), pasting only their creds:

  {
    "mcpServers": {
      "intervals-icu": {
        "command": "npx",
        "args": ["-y", "intervals-icu-mcp"],
        "env": {
          "INTERVALS_API_KEY": "your_api_key_here",
          "INTERVALS_ATHLETE_ID": "i00000"
        }
      }
    }
  }

  Requires `npm publish` (a public package). The .mcpb path above needs no registry.
-->

Note: passing creds via the config `env` block (as above) works for the plain `node` setup too — you
don't strictly need a `.env` file if you set `INTERVALS_API_KEY` / `INTERVALS_ATHLETE_ID` there.

## Tools

- `get_athlete` — profile, current fitness (CTL/ATL/form)
- `list_activities` — training history in a date range
- `get_activity` — full detail of one activity
- `list_wellness` — sleep/HRV/RHR for recovery assessment
- `list_events` — calendar (planned + completed workouts)
- `create_event` — add a planned workout (structured intervals via `description`, e.g. `- 10m warmup Z1\n- 4x (5m Z4, 3m Z1)\n- 10m cooldown Z1`; `category` defaults to `WORKOUT`, use `RACE_A`/`RACE_B` for goal races)
- `create_events` — add many planned workouts at once (a whole training block) in one call
- `update_event` — edit a planned workout
- `delete_event` — remove a calendar entry
- `get_sport_settings` — FTP, threshold pace, LTHR and training zones per sport
- `get_activity_intervals` — interval/lap breakdown of an activity (execution vs target)
- `get_athlete_curves` — best-effort power/pace/HR curve over a period (fitness benchmark)
- `log_wellness` — log daily wellness (weight, RHR, HRV, sleep, fatigue…)
- `mark_event_done` — mark a planned workout as completed
- `get_athlete_summary` — aggregate training stats over a period
- `get_weather_forecast` — forecast for planning outdoor sessions
- `update_activity` — edit a completed activity's name/type/notes

All tools accept an optional `athlete_id` to override the `.env` default.

## Prompts (slash commands in Claude Desktop)

These guide the model through analysis → periodized plan → calendar using the tools above. The planning logic lives in the model, not in the server.

- `/plan_race` — args `sport` (triathlon/running/cycling/swimming), `distance` (e.g. `70.3`, `marathon`, `10k`), `race_date` (YYYY-MM-DD), optional `notes`. Reads your zones and current form, creates the race as a `RACE_A` goal, and generates the **first 3–4 week block** onto your calendar.
- `/next_block` — optional `notes`. Looks at what you actually completed vs. planned and your recomputed form, then generates the next 3–4 week block toward the same race. Run it after finishing each block.
- `/analyze_form` — optional `notes`. Read-only weekly check-in: fitness (CTL), fatigue (ATL), form (TSB), ramp rate, recovery trend + one recommendation.
- `/analyze_trainings` — optional `range` (`session`/`week`/`month`) + `notes`. Read-only analysis of completed training with actionable feedback (per-interval execution for `session`).
- `/todays_workout` — optional `notes`. "What should I do today?" Explains today's planned session (or suggests one) in plain language, factoring in current form and, for outdoor sessions, the weather. Read-only.
- `/log_today` — `notes` free text (e.g. `slept 7h, tired, weight 72`). Logs today's wellness by parsing the note into fields and calling `log_wellness`. The only prompt that writes.
