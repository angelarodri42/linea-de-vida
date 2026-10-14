// Shared types (safe to import from client components).

export type Settings = {
  total_years: number;
  squares_per_year: number;
  show_calendar_year: boolean; // also label each year with its calendar year
  start_year: number; // calendar year of timeline year 1
};

/** The settings that limit how small the timeline can get. */
export type SizeSettings = Pick<Settings, "total_years" | "squares_per_year">;

export type Memory = {
  id: number;
  year_index: number; // 0-based
  position_index: number; // 0-based
  title: string;
  content: string;
  created_at: string;
};

export const LIMITS = {
  maxYears: 150,
  maxSquaresPerYear: 100,
  minStartYear: 1900,
  maxStartYear: 2100,
} as const;

export const slotKey = (year: number, position: number) => `${year}:${position}`;
