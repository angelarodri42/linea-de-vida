import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { LIMITS, type Memory, type Settings } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "memories.db");

/** Error whose message is safe to show to the user (mapped to a 4xx response). */
export class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function init(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id               INTEGER PRIMARY KEY CHECK (id = 1),
      total_years      INTEGER NOT NULL DEFAULT 30,
      squares_per_year INTEGER NOT NULL DEFAULT 10
    );
    INSERT OR IGNORE INTO settings (id, total_years, squares_per_year) VALUES (1, 30, 10);

    CREATE TABLE IF NOT EXISTS memories (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      year_index     INTEGER NOT NULL,
      position_index INTEGER NOT NULL,
      title          TEXT    NOT NULL DEFAULT '',
      content        TEXT    NOT NULL DEFAULT '',
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (year_index, position_index)
    );
  `);
  return db;
}

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __memoryDb?: Database.Database };
const db = globalForDb.__memoryDb ?? (globalForDb.__memoryDb = init());

// ---------- Settings ----------

export function getSettings(): Settings {
  return db
    .prepare("SELECT total_years, squares_per_year FROM settings WHERE id = 1")
    .get() as Settings;
}

/** Smallest values the settings may shrink to without hiding an existing memory. */
export function getSettingsMinimums(): Settings {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(year_index) + 1, 1) AS total_years, COALESCE(MAX(position_index) + 1, 1) AS squares_per_year FROM memories"
    )
    .get() as Settings;
  return row;
}

export function updateSettings(input: Partial<Settings>): Settings {
  const current = getSettings();
  const next: Settings = {
    total_years: input.total_years ?? current.total_years,
    squares_per_year: input.squares_per_year ?? current.squares_per_year,
  };

  if (!isPosInt(next.total_years) || next.total_years > LIMITS.maxYears) {
    throw new UserError(`Los años deben ser un número entero entre 1 y ${LIMITS.maxYears}.`);
  }
  if (!isPosInt(next.squares_per_year) || next.squares_per_year > LIMITS.maxSquaresPerYear) {
    throw new UserError(
      `Las casillas por año deben ser un número entero entre 1 y ${LIMITS.maxSquaresPerYear}.`
    );
  }

  // Non-destructive: never allow a shrink that would orphan a written memory.
  const min = getSettingsMinimums();
  if (next.total_years < min.total_years) {
    throw new UserError(
      `Tienes recuerdos en el año ${min.total_years}. Muévelos antes de reducir los años por debajo de ${min.total_years}.`,
      409
    );
  }
  if (next.squares_per_year < min.squares_per_year) {
    throw new UserError(
      `Hay un recuerdo en la casilla ${min.squares_per_year}. Muévelo antes de reducir las casillas por año por debajo de ${min.squares_per_year}.`,
      409
    );
  }

  db.prepare("UPDATE settings SET total_years = ?, squares_per_year = ? WHERE id = 1").run(
    next.total_years,
    next.squares_per_year
  );
  return next;
}

// ---------- Memories ----------

export function listMemories(): Memory[] {
  return db
    .prepare("SELECT * FROM memories ORDER BY year_index, position_index")
    .all() as Memory[];
}

function assertSlotInRange(year: number, position: number) {
  const s = getSettings();
  if (!Number.isInteger(year) || year < 0 || year >= s.total_years) {
    throw new UserError("El año está fuera de la línea de tiempo.");
  }
  if (!Number.isInteger(position) || position < 0 || position >= s.squares_per_year) {
    throw new UserError("La casilla está fuera del año.");
  }
}

/** Create or update the memory stored in a given slot. */
export function saveMemory(input: {
  year_index: number;
  position_index: number;
  title: string;
  content: string;
}): Memory {
  assertSlotInRange(input.year_index, input.position_index);
  const title = (input.title ?? "").trim();
  const content = input.content ?? "";
  if (!title && !content.trim()) {
    throw new UserError("Añade un título o algo de contenido antes de guardar.");
  }

  return db
    .prepare(
      `INSERT INTO memories (year_index, position_index, title, content)
       VALUES (@year_index, @position_index, @title, @content)
       ON CONFLICT (year_index, position_index)
       DO UPDATE SET title = excluded.title, content = excluded.content
       RETURNING *`
    )
    .get({
      year_index: input.year_index,
      position_index: input.position_index,
      title: title || "Recuerdo sin título",
      content,
    }) as Memory;
}

export function deleteMemory(id: number): void {
  const res = db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  if (res.changes === 0) throw new UserError("Recuerdo no encontrado.", 404);
}

/**
 * Move a memory to another slot. If the target slot is occupied, the two
 * memories swap places. Runs in a single transaction.
 */
export const moveMemory = db.transaction(
  (id: number, toYear: number, toPosition: number): Memory[] => {
    assertSlotInRange(toYear, toPosition);

    const source = db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as Memory | undefined;
    if (!source) throw new UserError("Recuerdo no encontrado.", 404);
    if (source.year_index === toYear && source.position_index === toPosition) {
      return [source];
    }

    const target = db
      .prepare("SELECT * FROM memories WHERE year_index = ? AND position_index = ?")
      .get(toYear, toPosition) as Memory | undefined;

    const setSlot = db.prepare(
      "UPDATE memories SET year_index = ?, position_index = ? WHERE id = ?"
    );

    if (target) {
      // Park the target in a unique off-timeline slot to satisfy UNIQUE during the swap.
      setSlot.run(-1, -target.id, target.id);
      setSlot.run(toYear, toPosition, source.id);
      setSlot.run(source.year_index, source.position_index, target.id);
    } else {
      setSlot.run(toYear, toPosition, source.id);
    }

    const get = db.prepare("SELECT * FROM memories WHERE id = ?");
    const updated = [get.get(source.id) as Memory];
    if (target) updated.push(get.get(target.id) as Memory);
    return updated;
  }
);

function isPosInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1;
}
