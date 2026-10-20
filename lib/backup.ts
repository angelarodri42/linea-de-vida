// Export / import of the whole timeline as a JSON file the user keeps.
import { DEFAULT_SETTINGS, UserError, isIntIn, minimums } from "./timeline";
import { LIMITS, slotKey, type AppState, type Memory, type Settings } from "./types";

const APP = "linea-de-vida";
const VERSION = 1;

type BackupFile = {
  app: typeof APP;
  version: number;
  exported_at: string;
  settings: Settings;
  memories: Omit<Memory, "id">[];
};

/** Days after which the app nudges the user to download a new copy. */
export const BACKUP_REMINDER_DAYS = 14;

export function downloadBackup(state: AppState): void {
  const file: BackupFile = {
    app: APP,
    version: VERSION,
    exported_at: new Date().toISOString(),
    settings: state.settings,
    memories: [...state.memories]
      .sort((a, b) => a.year_index - b.year_index || a.position_index - b.position_index)
      .map(({ id: _id, ...m }) => m),
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `linea-de-vida-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Validate a backup file and turn it into a fresh AppState. Throws UserError if invalid. */
export function parseBackup(text: string): AppState {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new UserError("El archivo no es una copia válida (no es JSON).");
  }
  if (!isObject(data) || data.app !== APP) {
    throw new UserError("Este archivo no es una copia de Línea de Recuerdos.");
  }
  if (typeof data.version !== "number" || data.version > VERSION) {
    throw new UserError("Esta copia es de una versión más nueva de la app. Actualiza la página.");
  }
  if (!Array.isArray(data.memories)) throw new UserError("La copia no contiene recuerdos.");

  const seen = new Set<string>();
  const memories: Memory[] = data.memories.map((raw, i) => {
    const n = i + 1;
    if (
      !isObject(raw) ||
      !isIntIn(raw.year_index, 0, LIMITS.maxYears - 1) ||
      !isIntIn(raw.position_index, 0, LIMITS.maxSquaresPerYear - 1) ||
      typeof raw.title !== "string" ||
      typeof raw.content !== "string"
    ) {
      throw new UserError(`El recuerdo nº ${n} de la copia está dañado.`);
    }
    const key = slotKey(raw.year_index, raw.position_index);
    if (seen.has(key)) throw new UserError(`La copia tiene dos recuerdos en la misma casilla (${n}).`);
    seen.add(key);
    const created = typeof raw.created_at === "string" ? new Date(raw.created_at) : null;
    return {
      id: n,
      year_index: raw.year_index,
      position_index: raw.position_index,
      title: raw.title,
      content: raw.content,
      created_at: created && !isNaN(created.getTime()) ? created.toISOString() : new Date().toISOString(),
    };
  });

  const s = isObject(data.settings) ? data.settings : {};
  const min = minimums(memories);
  const settings: Settings = {
    // Grow the timeline if needed so every imported memory is visible.
    total_years: Math.max(
      isIntIn(s.total_years, 1, LIMITS.maxYears) ? s.total_years : DEFAULT_SETTINGS.total_years,
      min.total_years
    ),
    squares_per_year: Math.max(
      isIntIn(s.squares_per_year, 1, LIMITS.maxSquaresPerYear)
        ? s.squares_per_year
        : DEFAULT_SETTINGS.squares_per_year,
      min.squares_per_year
    ),
    show_calendar_year:
      typeof s.show_calendar_year === "boolean" ? s.show_calendar_year : DEFAULT_SETTINGS.show_calendar_year,
    start_year: isIntIn(s.start_year, LIMITS.minStartYear, LIMITS.maxStartYear)
      ? s.start_year
      : DEFAULT_SETTINGS.start_year,
  };

  return {
    settings,
    memories,
    next_id: memories.length + 1,
    // The user evidently has this file, so it counts as a backup.
    last_backup_at: new Date().toISOString(),
  };
}

/** Whole days since the last backup, or null if there has never been one. */
export function daysSinceBackup(state: AppState): number | null {
  if (!state.last_backup_at) return null;
  return Math.floor((Date.now() - new Date(state.last_backup_at).getTime()) / 86_400_000);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
