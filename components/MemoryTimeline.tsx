"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MousePointerClick, Move } from "lucide-react";
import { slotKey, type Memory, type Settings, type SizeSettings } from "@/lib/types";
import SettingsBar from "./SettingsBar";
import MemorySquare from "./MemorySquare";
import SidePanel from "./SidePanel";

type Slot = { year: number; position: number };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `La solicitud falló (${res.status})`);
  return data as T;
}

function toMap(list: Memory[]) {
  return new Map(list.map((m) => [slotKey(m.year_index, m.position_index), m]));
}

export default function MemoryTimeline({
  initialSettings,
  initialMemories,
}: {
  initialSettings: Settings;
  initialMemories: Memory[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [memories, setMemories] = useState(() => toMap(initialMemories));
  const [selected, setSelected] = useState<Slot | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Smallest settings that keep every memory visible (non-destructive resizing).
  const minimums = useMemo<SizeSettings>(() => {
    let y = 0;
    let p = 0;
    for (const m of memories.values()) {
      y = Math.max(y, m.year_index + 1);
      p = Math.max(p, m.position_index + 1);
    }
    return { total_years: Math.max(1, y), squares_per_year: Math.max(1, p) };
  }, [memories]);

  // Auto-hide toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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
  }, []);

  // ---------- Actions ----------

  async function applySettings(next: Settings) {
    try {
      const res = await api<{ settings: Settings }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setSettings(res.settings);
      setToast({ text: "Línea de tiempo actualizada", tone: "ok" });
    } catch (err) {
      setToast({ text: (err as Error).message, tone: "error" });
    }
  }

  const saveMemory = useCallback(async (slot: Slot, title: string, content: string) => {
    const saved = await api<Memory>("/api/memories", {
      method: "POST",
      body: JSON.stringify({
        year_index: slot.year,
        position_index: slot.position,
        title,
        content,
      }),
    });
    setMemories((prev) => new Map(prev).set(slotKey(saved.year_index, saved.position_index), saved));
    setToast({ text: "Recuerdo guardado", tone: "ok" });
    return saved;
  }, []);

  const deleteMemory = useCallback(async (memory: Memory) => {
    await api(`/api/memories/${memory.id}`, { method: "DELETE" });
    setMemories((prev) => {
      const next = new Map(prev);
      next.delete(slotKey(memory.year_index, memory.position_index));
      return next;
    });
    setPanelOpen(false);
    setToast({ text: "Recuerdo eliminado", tone: "ok" });
  }, []);

  async function moveMemory(id: number, to: Slot) {
    const before = memories;
    const source = [...before.values()].find((m) => m.id === id);
    if (!source) return;
    const from: Slot = { year: source.year_index, position: source.position_index };
    if (from.year === to.year && from.position === to.position) return;

    const fromKey = slotKey(from.year, from.position);
    const toKey = slotKey(to.year, to.position);
    const target = before.get(toKey);

    // Optimistic update: move, or swap if the target slot is filled.
    const next = new Map(before);
    next.delete(fromKey);
    next.set(toKey, { ...source, year_index: to.year, position_index: to.position });
    if (target) {
      next.set(fromKey, { ...target, year_index: from.year, position_index: from.position });
    }
    setMemories(next);

    // Keep the side panel attached to the memory it was showing.
    if (selected) {
      const selKey = slotKey(selected.year, selected.position);
      if (selKey === fromKey) setSelected(to);
      else if (target && selKey === toKey) setSelected(from);
    }

    try {
      await api<Memory[]>("/api/memories/move", {
        method: "POST",
        body: JSON.stringify({ id, to_year: to.year, to_position: to.position }),
      });
    } catch (err) {
      setMemories(before);
      setToast({ text: (err as Error).message, tone: "error" });
    }
  }

  const closePanel = useCallback(() => setPanelOpen(false), []);

  // ---------- Render ----------

  const years = Array.from({ length: settings.total_years }, (_, i) => i);
  const positions = Array.from({ length: settings.squares_per_year }, (_, i) => i);
  const selectedMemory = selected
    ? memories.get(slotKey(selected.year, selected.position))
    : undefined;

  return (
    <div className="flex h-screen flex-col">
      <SettingsBar
        settings={settings}
        minimums={minimums}
        memoryCount={memories.size}
        onApply={applySettings}
      />

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
                          dragging={dragId !== null}
                          isDragSource={memory !== undefined && memory.id === dragId}
                          isDragOver={dragOver === key && memory?.id !== dragId}
                          onClick={() => {
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

        <footer className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-6 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <MousePointerClick className="h-3.5 w-3.5" /> Haz clic en una casilla para escribir o leer
          </span>
          <span className="flex items-center gap-1.5">
            <Move className="h-3.5 w-3.5" /> Arrastra un recuerdo a otra casilla para moverlo o intercambiarlo
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
