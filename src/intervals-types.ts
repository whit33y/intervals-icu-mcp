// Response shapes for the intervals.icu API — ONLY the fields we actually read
// (in prompts.ts trim helpers). All optional: the API may omit any of them, and
// responses are cast, not validated (see intervals-client.ts request()).

export interface Athlete {
  name?: string;
  firstname?: string;
  lastname?: string;
  sex?: string;
  icu_resting_hr?: number;
  icu_weight?: number;
}

export interface Activity {
  id?: string;
  start_date_local?: string;
  type?: string;
  name?: string;
  moving_time?: number;
  icu_training_load?: number;
  distance?: number;
  // detailed single-activity metrics (trimActivityDetail)
  icu_intensity?: number;
  icu_weighted_avg_watts?: number;
  icu_average_watts?: number;
  icu_ftp?: number;
  icu_variability_index?: number;
  icu_efficiency_factor?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  total_elevation_gain?: number;
  average_speed?: number;
  trimp?: number;
  feel?: number;
  icu_rpe?: number;
}

export interface WellnessRecord {
  id?: string; // the date, YYYY-MM-DD
  ctl?: number;
  atl?: number;
  rampRate?: number;
  restingHR?: number;
  hrv?: number;
  sleepSecs?: number;
}

export interface SportSettings {
  types?: string[];
  ftp?: number;
  indoor_ftp?: number;
  lthr?: number;
  max_hr?: number;
  threshold_pace?: number | null;
  pace_units?: string;
  power_zones?: number[];
  hr_zones?: number[];
  pace_zones?: number[];
}

export interface CalendarEvent {
  id?: string | number;
  start_date_local?: string;
  name?: string;
  category?: string;
  type?: string;
  moving_time?: number;
}

export interface Interval {
  label?: string;
  type?: string;
  moving_time?: number;
  distance?: number;
  average_speed?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  intensity?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  zone?: string | number;
  decoupling?: number;
  total_elevation_gain?: number;
}

export interface ActivityIntervals {
  icu_intervals?: Interval[];
}

export interface SummaryRow {
  date?: string;
  count?: number;
  moving_time?: number;
  distance?: number;
  training_load?: number;
  total_elevation_gain?: number;
  fitness?: number;
  fatigue?: number;
  form?: number;
  rampRate?: number;
}
