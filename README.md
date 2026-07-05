# intervals.icu MCP Server

MCP server wrapping the [intervals.icu](https://intervals.icu) API: review training history, plan workouts, and add them to your calendar. If you've linked Garmin Connect in your intervals.icu account settings (Settings → Garmin), planned workouts you create here sync to your Garmin device automatically — no separate Garmin integration needed.

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

## Tools

- `get_athlete` — profile, current fitness (CTL/ATL/form)
- `list_activities` — training history in a date range
- `get_activity` — full detail of one activity
- `list_wellness` — sleep/HRV/RHR for recovery assessment
- `list_events` — calendar (planned + completed workouts)
- `create_event` — add a planned workout (structured intervals via `description`, e.g. `- 10m warmup Z1\n- 4x (5m Z4, 3m Z1)\n- 10m cooldown Z1`)
- `update_event` — edit a planned workout
- `delete_event` — remove a calendar entry

All tools accept an optional `athlete_id` to override the `.env` default.
