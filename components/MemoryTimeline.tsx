"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MousePointerClick, Move, X } from "lucide-react";
import { slotKey, type AppState, type Memory, type Settings, type Slot } from "@/lib/types";
import * as timeline from "@/lib/timeline";
import { loadState, onOtherTabChange, requestPersistence, saveState } from "@/lib/storage";
import { downloadBackup, parseBackup } from "@/lib/backup";
import SettingsBar from "./SettingsBar";
import MemorySquare from "./MemorySquare";
import SidePanel from "./SidePanel";
import Notices from "./Notices";

export default function MemoryTimeline() {
  const [app, setApp] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null); // tap-to-move mode
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Latest state for async handlers, and a queue so writes reach IndexedDB in order.
  const stateRef = useRef<AppState | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const persistAsked = useRef(false);

  // ---------- Loading & persistence ----------

  useEffect(() => {
    const load = () =>
      loadState()
        .then((s) => {
          stateRef.current = s;
          setApp(s);
        })
        .catch((err: Error) => setLoadError(err.message));
    load();
    return onOtherTabChange(load);
  }, []);

  /** Show `next` immediately and save it; reverts the screen if the save fails. */
  const commit = useCallback((next: AppState): Promise<void> => {
    const prev = stateRef.current;
    stateRef.current = next;
    setApp(next);
    const write = writeQueue.current.then(() => saveState(next));
    writeQueue.current = write.catch(() => {});
    return write.catch((err: Error) => {
      if (stateRef.current === next && prev) {
        stateRef.current = prev;
        setApp(prev);
      }
      throw new Error(`No se pudo guardar en este navegador. ${err.message ?? ""}`.trim());
    });
  }, []);

  function askPersistenceOnce() {
    if (persistAsked.current) return;
    persistAsked.current = true;
    requestPersistence();
  }

  // ---------- UI effects ----------

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Escape cancels move mode.
  useEffect(() => {
    if (movingId === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMovingId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [movingId]);

  // Mouse wheel scrolls the timeline horizontally.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [app !== null]);

  const memories = useMemo(
    () => new Map((app?.memories ?? []).map((m) => [slotKey(m.year_index, m.position_index), m])),
    [app]
  );

  // ---------- Actions ----------

  const showError = (err: unknown) =>
    setToast({ text: err instanceof Error ? err.message : "Algo salió mal.", tone: "error" });

  async function applySettings(next: Settings) {
    try {
      await commit(timeline.updateSettings(stateRef.current!, next));
      setToast({ text: "Línea de tiempo actualizada", tone: "ok" });
    } catch (err) {
      showError(err);
    }
  }

  const saveMemory = useCallback(
    async (slot: Slot, title: string, content: string) => {
      const { state, memory } = timeline.saveMemory(stateRef.current!, slot, title, content);
      await commit(state);
      askPersistenceOnce();
      setToast({ text: "Recuerdo guardado", tone: "ok" });
      return memory;
    },
    [commit]
  );

  const deleteMemory = useCallback(
    async (memory: Memory) => {
      await commit(timeline.deleteMemory(stateRef.current!, memory.id));
      setPanelOpen(false);
      setToast({ text: "Recuerdo eliminado", tone: "ok" });
    },
    [commit]
  );

  async function moveMemory(id: number, to: Slot) {
    const before = stateRef.current!;
    const source = before.memories.find((m) => m.id === id);
    if (!source) return;
    const from: Slot = { year: source.year_index, position: source.position_index };
    const target = memories.get(slotKey(to.year, to.position));

    try {
      const next = timeline.moveMemory(before, id, to);
      if (next === before) return;
      // Keep the side panel attached to the memory it was showing.
      if (selected) {
        const sel = slotKey(selected.year, selected.position);
        if (sel === slotKey(from.year, from.position)) setSelected(to);
        else if (target && sel === slotKey(to.year, to.position)) setSelected(from);
      }
      await commit(next);
    } catch (err) {
      showError(err);
    }
  }

  function exportBackup() {
    const state = stateRef.current!;
    downloadBackup(state);
    commit({ ...state, last_backup_at: new Date().toISOString() }).catch(showError);
    setToast({ text: "Copia descargada", tone: "ok" });
  }

  async function importBackup(file: File) {
    try {
      const next = parseBackup(await file.text());
      const current = stateRef.current!.memories.length;
      const n = next.memories.length;
      const question =
        current === 0
          ? `¿Importar ${n} recuerdos de «${file.name}»?`
          : `«${file.name}» tiene ${n} recuerdos.\n\nReemplazarán los ${current} recuerdos que hay ahora en este navegador. Si quieres conservarlos, cancela y usa «Exportar» primero.\n\n¿Continuar?`;
      if (!window.confirm(question)) return;
      setPanelOpen(false);
      setMovingId(null);
      await commit(next);
      askPersistenceOnce();
      setToast({ text: `${n} recuerdos importados`, tone: "ok" });
    } catch (err) {
      showError(err);
    }
  }

  const closePanel = useCallback(() => setPanelOpen(false), []);

  const startMove = useCallback((memory: Memory) => {
    setPanelOpen(false);
    setMovingId(memory.id);
  }, []);

  // ---------- Render ----------

  if (loadError) {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-rose-700">
        {loadError}
      </div>
    );
  }
  if (!app) {
    return (
      <div className="flex h-dvh items-center justify-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando tus recuerdos…
      </div>
    );
  }

  const { settings } = app;
  const years = Array.from({ length: settings.total_years }, (_, i) => i);
  const positions = Array.from({ length: settings.squares_per_year }, (_, i) => i);
  const selectedMemory = selected
    ? memories.get(slotKey(selected.year, selected.position))
    : undefined;
  const movingMemory = movingId !== null ? app.memories.find((m) => m.id === movingId) : undefined;

  return (
    <div className="flex h-dvh flex-col">
      <SettingsBar
        settings={settings}
        minimums={timeline.minimums(app.memories)}
        memoryCount={app.memories.length}
        onApply={applySettings}
        onExport={exportBackup}
        onImport={() => importRef.current?.click()}
      />
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow choosing the same file again
          if (file) importBackup(file);
        }}
      />

      <Notices state={app} onExport={exportBackup} />

      {movingMemory && (
        <div className="flex items-center justify-center gap-3 bg-violet-600 px-4 py-2.5 text-sm text-white">
          <Move className="h-4 w-4 shrink-0" />
          <span>
            Toca una casilla para mover <strong>«{movingMemory.title}»</strong>
          </span>
          <button
            type="button"
            onClick={() => setMovingId(null)}
            className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-xs font-medium hover:bg-white/25"
          >
            <X className="h-3.5 w-3.5" /> Cancelar
          </button>
        </div>
      )}

      <main className="relative flex flex-1 flex-col justify-center overflow-hidden">
        <div
          ref={scrollRef}
          className={`timeline-scroll overflow-x-auto overflow-y-hidden transition-[padding] duration-300 ${
            panelOpen ? "md:pr-[28rem]" : ""
          }`}
        >
          <div className="flex w-max items-stretch px-6">
            {years.map((year) => {
              return (
                // Half the square gap (1.5 = 6px) on each side of the divider, so the
                // spacing across a year boundary matches the spacing between squares.
                <section
                  key={year}
                  className={`flex shrink-0 flex-col gap-2 px-[3px] pb-14 pt-4 ${
                    year < settings.total_years - 1 ? "border-r border-zinc-200" : ""
                  }`}
                >
                  <h2 className="flex items-baseline gap-1.5 text-sm font-semibold tabular-nums text-zinc-800">
                    {year + 1}
                    {settings.show_calendar_year && (
                      <span className="text-[11px] font-normal text-zinc-400">
                        {settings.start_year + year}
                      </span>
                    )}
                  </h2>
                  <div className="flex gap-1.5">
                    {positions.map((position) => {
                      const key = slotKey(year, position);
                      const memory = memories.get(key);
                      return (
                        <MemorySquare
                          key={key}
                          year={year}
                          position={position}
                          memory={memory}
                          selected={
                            panelOpen &&
                            selected?.year === year &&
                            selected?.position === position
                          }
                          dragging={dragId !== null || movingId !== null}
                          isDragSource={
                            memory !== undefined && (memory.id === dragId || memory.id === movingId)
                          }
                          isDragOver={dragOver === key && memory?.id !== dragId}
                          onClick={() => {
                            if (movingId !== null) {
                              const id = movingId;
                              setMovingId(null);
                              moveMemory(id, { year, position });
                              return;
                            }
                            setSelected({ year, position });
                            setPanelOpen(true);
                          }}
                          onDragStart={(e) => {
                            if (!memory) return e.preventDefault();
                            e.dataTransfer.setData("text/plain", String(memory.id));
                            e.dataTransfer.effectAllowed = "move";
                            setDragId(memory.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOver(null);
                          }}
                          onDragOver={(e) => {
                            if (dragId === null) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dragOver !== key) setDragOver(key);
                          }}
                          onDragLeave={() => {
                            setDragOver((cur) => (cur === key ? null : cur));
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const id = Number(e.dataTransfer.getData("text/plain")) || dragId;
                            setDragId(null);
                            setDragOver(null);
                            if (id) moveMemory(id, { year, position });
                          }}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <footer className="pointer-events-none absolute inset-x-0 bottom-4 hidden justify-center gap-6 text-xs text-zinc-400 sm:flex">
          <span className="flex items-center gap-1.5">
            <MousePointerClick className="h-3.5 w-3.5" /> Haz clic en una casilla para escribir o leer
          </span>
          <span className="flex items-center gap-1.5">
            <Move className="h-3.5 w-3.5" /> Arrastra un recuerdo (o usa «Mover») para moverlo o intercambiarlo
          </span>
        </footer>
      </main>

      <SidePanel
        open={panelOpen}
        slot={selected}
        memory={selectedMemory}
        onClose={closePanel}
        onSave={saveMemory}
        onDelete={deleteMemory}
        onStartMove={startMove}
      />

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-6 z-50 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
            toast.tone === "ok" ? "bg-zinc-900 text-white" : "bg-rose-600 text-white"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
