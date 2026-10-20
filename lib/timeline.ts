// Pure timeline rules. Every function returns a new AppState and never mutates its input.
import { LIMITS, type AppState, type Memory, type Settings, type SizeSettings, type Slot } from "./types";

/** Error whose message is safe to show to the user. */
export class UserError extends Error {}

export const DEFAULT_SETTINGS: Settings = {
  total_years: 30,
  squares_per_year: 10,
  show_calendar_year: false,
  start_year: 2000,
};

export function defaultState(): AppState {
  return { settings: { ...DEFAULT_SETTINGS }, memories: [], next_id: 1, last_backup_at: null };
}

/** Smallest values the settings may shrink to without hiding an existing memory. */
export function minimums(memories: Memory[]): SizeSettings {
  let years = 1;
  let squares = 1;
  for (const m of memories) {
    years = Math.max(years, m.year_index + 1);
    squares = Math.max(squares, m.position_index + 1);
  }
  return { total_years: years, squares_per_year: squares };
}

export function updateSettings(state: AppState, next: Settings): AppState {
  if (!isIntIn(next.total_years, 1, LIMITS.maxYears)) {
    throw new UserError(`Los años deben ser un número entero entre 1 y ${LIMITS.maxYears}.`);
  }
  if (!isIntIn(next.squares_per_year, 1, LIMITS.maxSquaresPerYear)) {
    throw new UserError(
      `Las casillas por año deben ser un número entero entre 1 y ${LIMITS.maxSquaresPerYear}.`
    );
  }
  if (!isIntIn(next.start_year, LIMITS.minStartYear, LIMITS.maxStartYear)) {
    throw new UserError(
      `El año inicial debe estar entre ${LIMITS.minStartYear} y ${LIMITS.maxStartYear}.`
    );
  }

  // Non-destructive: never allow a shrink that would hide a written memory.
  const min = minimums(state.memories);
  if (next.total_years < min.total_years) {
    throw new UserError(
      `Tienes recuerdos en el año ${min.total_years}. Muévelos antes de reducir los años por debajo de ${min.total_years}.`
    );
  }
  if (next.squares_per_year < min.squares_per_year) {
    throw new UserError(
      `Hay un recuerdo en la casilla ${min.squares_per_year}. Muévelo antes de reducir las casillas por año por debajo de ${min.squares_per_year}.`
    );
  }

  return { ...state, settings: { ...next } };
}

/** Create or update the memory stored in a given slot. */
export function saveMemory(
  state: AppState,
  slot: Slot,
  title: string,
  content: string
): { state: AppState; memory: Memory } {
  assertSlotInRange(state.settings, slot);
  const cleanTitle = title.trim();
  if (!cleanTitle && !content.trim()) {
    throw new UserError("Añade un título o algo de contenido antes de guardar.");
  }
  const finalTitle = cleanTitle || "Recuerdo sin título";

  const existing = findAt(state.memories, slot);
  if (existing) {
    const memory = { ...existing, title: finalTitle, content };
    return {
      state: { ...state, memories: state.memories.map((m) => (m.id === existing.id ? memory : m)) },
      memory,
    };
  }

  const memory: Memory = {
    id: state.next_id,
    year_index: slot.year,
    position_index: slot.position,
    title: finalTitle,
    content,
    created_at: new Date().toISOString(),
  };
  return {
    state: { ...state, memories: [...state.memories, memory], next_id: state.next_id + 1 },
    memory,
  };
}

export function deleteMemory(state: AppState, id: number): AppState {
  if (!state.memories.some((m) => m.id === id)) throw new UserError("Recuerdo no encontrado.");
  return { ...state, memories: state.memories.filter((m) => m.id !== id) };
}

/** Move a memory to another slot. If the target slot is filled, the two swap places. */
export function moveMemory(state: AppState, id: number, to: Slot): AppState {
  assertSlotInRange(state.settings, to);
  const source = state.memories.find((m) => m.id === id);
  if (!source) throw new UserError("Recuerdo no encontrado.");
  if (source.year_index === to.year && source.position_index === to.position) return state;

  const target = findAt(state.memories, to);
  return {
    ...state,
    memories: state.memories.map((m) => {
      if (m.id === source.id) return { ...m, year_index: to.year, position_index: to.position };
      if (target && m.id === target.id) {
        return { ...m, year_index: source.year_index, position_index: source.position_index };
      }
      return m;
    }),
  };
}

function findAt(memories: Memory[], slot: Slot) {
  return memories.find((m) => m.year_index === slot.year && m.position_index === slot.position);
}

function assertSlotInRange(settings: Settings, slot: Slot) {
  if (!isIntIn(slot.year, 0, settings.total_years - 1)) {
    throw new UserError("El año está fuera de la línea de tiempo.");
  }
  if (!isIntIn(slot.position, 0, settings.squares_per_year - 1)) {
    throw new UserError("La casilla está fuera del año.");
  }
}

export function isIntIn(n: unknown, min: number, max: number): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
}
