// Browser persistence: the whole AppState is one record in IndexedDB.
// A single record keeps every change atomic (a swap can never be half-saved).
import { defaultState } from "./timeline";
import type { AppState } from "./types";

const DB_NAME = "linea-de-vida";
const STORE = "kv";
const KEY = "state";
const CHANNEL = "linea-de-vida-changes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador no permite guardar datos."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("No se pudo abrir el almacenamiento."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error ?? new Error("Error de almacenamiento."));
      tx.onabort = () => reject(tx.error ?? new Error("Error de almacenamiento."));
    });
  } finally {
    db.close();
  }
}

export async function loadState(): Promise<AppState> {
  const stored = await withStore<AppState | undefined>("readonly", (s) => s.get(KEY));
  if (!stored) return defaultState();
  // Fill in any fields added in later versions.
  const base = defaultState();
  return {
    ...base,
    ...stored,
    settings: { ...base.settings, ...stored.settings },
  };
}

export async function saveState(state: AppState): Promise<void> {
  await withStore("readwrite", (s) => s.put(state, KEY));
  notifyOtherTabs();
}

// ---------- Keep several open tabs in sync ----------

function channel(): BroadcastChannel | null {
  return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
}

function notifyOtherTabs() {
  const ch = channel();
  ch?.postMessage("changed");
  ch?.close();
}

/** Calls `cb` when another tab saves. Returns an unsubscribe function. */
export function onOtherTabChange(cb: () => void): () => void {
  const ch = channel();
  if (!ch) return () => {};
  ch.onmessage = cb;
  return () => ch.close();
}

/**
 * Ask the browser to keep this site's data even when it is low on space.
 * Browsers may grant it silently, ask, or decline; it never hurts to ask.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
