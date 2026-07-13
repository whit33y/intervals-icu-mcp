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
INTERVALS_EQUIPMENT=                  # optional, your gear per sport (see below)
```

`INTERVALS_EQUIPMENT` is optional free text describing your gear, e.g. `Bike: power meter, HR belt; Run: HR belt + GPS watch (no run power); Indoor: smart trainer`. When set, planned workouts target the right metric (power / pace / HR) for what you actually have and each session tells you what to bring.

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
- `create_event` — add a planned workout. `description` uses intervals.icu syntax that renders as named laps, e.g. `Gear: power meter, HR belt\n- 10m Warmup ramp 50-70%\n- 4x (5m Work Z4, 3m Recovery Z1)\n- 10m Cooldown Z1` (one `- ` step per line = one lap; targets can be zones/power/HR/pace/cadence; a plain first line like `Gear: …` is a note, not a lap). `category` defaults to `WORKOUT`, use `RACE_A`/`RACE_B` for goal races
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

---

# Serwer MCP intervals.icu (instrukcja PL)

Serwer MCP opakowujący API [intervals.icu](https://intervals.icu): przeglądaj historię treningów, planuj jednostki i dodawaj je do kalendarza. Jeśli w ustawieniach konta intervals.icu połączyłeś Garmin Connect (Settings → Garmin), zaplanowane treningi utworzone tutaj synchronizują się automatycznie z zegarkiem Garmin — nie potrzebujesz osobnej integracji z Garminem.

## Załóż konto intervals.icu i zdobądź dane dostępowe

1. **Załóż konto** — wejdź na [intervals.icu](https://www.intervals.icu/), kliknij **Sign up free** i przejdź proces rejestracji.
2. **Połącz Garmin** (żeby aktywności się importowały, a zaplanowane treningi trafiały na zegarek) — **Settings → Connections → Garmin**, zaloguj się i przyznaj **wszystkie uprawnienia**.
3. **Pobierz klucz API i ID zawodnika** — **Settings → Developer**. Skopiuj **API Key** oraz swoje **Athlete ID** (widoczne na tej stronie, w formacie `i123456`). To dwie wartości, które wpiszesz do `.env` / formularza instalacji.

## Konfiguracja

```bash
npm install
cp .env.example .env
```

Uzupełnij `.env` własnymi danymi:

```
INTERVALS_API_KEY=your_api_key_here   # intervals.icu Settings -> Developer
INTERVALS_ATHLETE_ID=i00000           # twoje athlete id, np. i632406
INTERVALS_EQUIPMENT=                  # opcjonalnie, twój sprzęt wg dyscypliny (patrz niżej)
```

`INTERVALS_EQUIPMENT` jest opcjonalnym, dowolnym tekstem opisującym twój sprzęt, np. `Bike: power meter, HR belt; Run: HR belt + GPS watch (no run power); Indoor: smart trainer`. Gdy jest ustawione, zaplanowane treningi celują we właściwą metrykę (moc / tempo / tętno) w zależności od tego, co faktycznie masz, a każda jednostka podpowiada, co zabrać.

Zbuduj projekt:

```bash
npm run build
```

## Użycie z Claude Code / Claude Desktop

Dodaj do konfiguracji MCP (`claude mcp add` lub JSON `mcpServers` w kliencie):

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

Każda osoba korzystająca z tego serwera używa tego samego kodu i ustawia jedynie własny `.env` z własnym kluczem API / ID zawodnika.

## Instalacja jednym kliknięciem dla użytkowników nietechnicznych (.mcpb)

Claude Desktop potrafi zainstalować to jako paczkę (MCPB, wcześniej „Desktop Extensions"). Użytkownik klika dwukrotnie plik `.mcpb`, dostaje **formularz ustawień**, wkleja swój klucz API + ID zawodnika, a Claude Desktop wstrzykuje je jako zmienne środowiskowe — bez klonowania, bez `.env`, bez edycji JSON-a.

Zbuduj paczkę raz:

```bash
npm run pack        # build → instalacja prod → tworzy intervals-icu-mcp.mcpb
```

Następnie udostępnij plik `intervals-icu-mcp.mcpb`. Konfiguracja znajduje się w `manifest.json` (mapowanie `user_config` → `env`).

**Instalacja rozszerzenia:**

1. Otwórz Claude Desktop
2. **Settings → Extensions → Advanced settings**
3. **Install extension** → wybierz plik `intervals-icu-mcp.mcpb` → **Install**
4. Wklej swój klucz API + ID zawodnika w formularzu
5. **Włącz** (Enable) rozszerzenie
6. Zezwól na uprawnienia, gdy pojawi się prośba

**Użycie w czacie:**

1. Kliknij **+** w polu czatu
2. **Connectors → Add from intervals-icu**
3. Wybierz umiejętność / narzędzie

Uwaga: przekazywanie danych dostępowych przez blok `env` w konfiguracji (jak wyżej) działa też dla zwykłego uruchomienia przez `node` — nie musisz koniecznie mieć pliku `.env`, jeśli ustawisz tam `INTERVALS_API_KEY` / `INTERVALS_ATHLETE_ID`.

## Narzędzia

- `get_athlete` — profil, aktualna forma (CTL/ATL/forma)
- `list_activities` — historia treningów w zakresie dat
- `get_activity` — pełne szczegóły jednej aktywności
- `list_wellness` — sen/HRV/RHR do oceny regeneracji
- `list_events` — kalendarz (zaplanowane + wykonane treningi)
- `create_event` — dodaj zaplanowany trening. `description` używa składni intervals.icu, która renderuje się jako nazwane odcinki, np. `Gear: power meter, HR belt\n- 10m Warmup ramp 50-70%\n- 4x (5m Work Z4, 3m Recovery Z1)\n- 10m Cooldown Z1` (jeden krok `- ` na linię = jeden odcinek; cele mogą być strefami/mocą/tętnem/tempem/kadencją; zwykła pierwsza linia typu `Gear: …` to notatka, nie odcinek). `category` domyślnie `WORKOUT`, użyj `RACE_A`/`RACE_B` dla zawodów docelowych
- `create_events` — dodaj wiele zaplanowanych treningów naraz (cały blok treningowy) w jednym wywołaniu
- `update_event` — edytuj zaplanowany trening
- `delete_event` — usuń wpis z kalendarza
- `get_sport_settings` — FTP, tempo progowe, LTHR i strefy treningowe wg dyscypliny
- `get_activity_intervals` — rozbicie na odcinki/okrążenia aktywności (wykonanie vs cel)
- `get_athlete_curves` — krzywa najlepszych wysiłków mocy/tempa/tętna w okresie (benchmark formy)
- `log_wellness` — zapisz dzienne wellness (waga, RHR, HRV, sen, zmęczenie…)
- `mark_event_done` — oznacz zaplanowany trening jako wykonany
- `get_athlete_summary` — zbiorcze statystyki treningowe za okres
- `get_weather_forecast` — prognoza do planowania sesji na zewnątrz
- `update_activity` — edytuj nazwę/typ/notatki wykonanej aktywności

Wszystkie narzędzia przyjmują opcjonalne `athlete_id`, które nadpisuje domyślną wartość z `.env`.

## Prompty (komendy slash w Claude Desktop)

Prowadzą model przez analizę → periodyzowany plan → kalendarz przy użyciu powyższych narzędzi. Logika planowania jest w modelu, nie w serwerze.

- `/plan_race` — argumenty `sport` (triathlon/running/cycling/swimming), `distance` (np. `70.3`, `marathon`, `10k`), `race_date` (RRRR-MM-DD), opcjonalnie `notes`. Czyta twoje strefy i aktualną formę, tworzy zawody jako cel `RACE_A` i generuje **pierwszy blok 3–4 tygodni** w twoim kalendarzu.
- `/next_block` — opcjonalnie `notes`. Patrzy na to, co faktycznie wykonałeś vs zaplanowałeś oraz na przeliczoną formę, po czym generuje kolejny blok 3–4 tygodni w kierunku tych samych zawodów. Uruchamiaj po zakończeniu każdego bloku.
- `/analyze_form` — opcjonalnie `notes`. Tylko do odczytu, cotygodniowy przegląd: kondycja (CTL), zmęczenie (ATL), forma (TSB), tempo narastania obciążenia, trend regeneracji + jedna rekomendacja.
- `/analyze_trainings` — opcjonalnie `range` (`session`/`week`/`month`) + `notes`. Tylko do odczytu, analiza wykonanych treningów z konkretnymi wskazówkami (wykonanie odcinek po odcinku dla `session`).
- `/todays_workout` — opcjonalnie `notes`. „Co mam dziś zrobić?" Wyjaśnia dzisiejszą zaplanowaną sesję (lub proponuje ją) prostym językiem, uwzględniając aktualną formę oraz, dla sesji na zewnątrz, pogodę. Tylko do odczytu.
- `/log_today` — `notes` jako dowolny tekst (np. `slept 7h, tired, weight 72`). Zapisuje dzisiejsze wellness, parsując notatkę na pola i wywołując `log_wellness`. Jedyny prompt, który zapisuje.
