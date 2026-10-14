// Shared types (safe to import from client components).

export type Settings = {
  total_years: number;
  squares_per_year: number;
};

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
} as const;

export const slotKey = (year: number, position: number) => `${year}:${position}`;
