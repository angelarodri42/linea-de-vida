"use client";

import { useEffect, useRef, useState } from "react";
import { X, Save, Trash2, Loader2, CalendarDays, Move } from "lucide-react";
import type { Memory, Slot } from "@/lib/types";

type Props = {
  open: boolean;
  slot: Slot | null;
  memory?: Memory;
  onClose: () => void;
  onSave: (slot: Slot, title: string, content: string) => Promise<Memory>;
  onDelete: (memory: Memory) => Promise<void>;
  onStartMove: (memory: Memory) => void;
};

export default function SidePanel({
  open,
  slot,
  memory,
  onClose,
  onSave,
  onDelete,
  onStartMove,
}: Props) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside
      aria-hidden={!open}
      className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10 transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      {slot && (
        <MemoryForm
          // Keyed by memory id so a memory being dragged elsewhere keeps its unsaved edits;
          // empty slots are keyed by position.
          key={memory ? `m${memory.id}` : `e${slot.year}:${slot.position}`}
          slot={slot}
          memory={memory}
          open={open}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
          onStartMove={onStartMove}
        />
      )}
    </aside>
  );
}

function MemoryForm({
  slot,
  memory,
  open,
  onClose,
  onSave,
  onDelete,
  onStartMove,
}: {
  slot: Slot;
  memory?: Memory;
  open: boolean;
  onClose: () => void;
  onSave: Props["onSave"];
  onDelete: Props["onDelete"];
  onStartMove: Props["onStartMove"];
}) {
  const [title, setTitle] = useState(memory?.title ?? "");
  const [content, setContent] = useState(memory?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) titleRef.current?.focus({ preventScroll: true });
  }, [open]);

  const dirty = title !== (memory?.title ?? "") || content !== (memory?.content ?? "");
  const canSave = dirty && (title.trim() !== "" || content.trim() !== "") && !saving;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await onSave(slot, title, content);
      setTitle(saved.title);
      setContent(saved.content);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!memory) return;
    if (!window.confirm(`¿Eliminar «${memory.title}»? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(memory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
      setDeleting(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Ctrl/Cmd+S or Ctrl/Cmd+Enter saves.
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "Enter")) {
      e.preventDefault();
      save();
    }
  }

  return (
    <form onSubmit={save} onKeyDown={onKeyDown} className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Año {slot.year + 1} · Casilla {slot.position + 1}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
            <CalendarDays className="h-3.5 w-3.5" />
            {memory ? `Escrito el ${formatDate(memory.created_at)}` : "Casilla vacía — escribe un nuevo recuerdo"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Cerrar panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">Título</span>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Primer día de colegio"
            className="h-11 rounded-lg border border-zinc-300 px-3 text-base font-medium outline-none transition placeholder:text-zinc-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          <span className="flex items-center justify-between text-xs font-medium text-zinc-500">
            Recuerdo
            <span className="font-normal tabular-nums text-zinc-400">
              {words} {words === 1 ? "palabra" : "palabras"}
            </span>
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="¿Qué pasó? ¿Quién estaba allí? ¿Cómo te sentiste?"
            className="min-h-64 flex-1 resize-none rounded-lg border border-zinc-300 px-3.5 py-3 font-serif text-[15px] leading-relaxed outline-none transition placeholder:text-zinc-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-zinc-100 px-6 py-4">
        {memory && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Eliminar
          </button>
        )}
        {memory && (
          <button
            type="button"
            onClick={() => onStartMove(memory)}
            disabled={dirty}
            title={dirty ? "Guarda los cambios antes de mover" : "Mover a otra casilla"}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Move className="h-4 w-4" />
            Mover
          </button>
        )}
        <span className="ml-auto hidden text-xs text-zinc-400 sm:inline">
          {dirty ? "Cambios sin guardar" : savedAt ? "Guardado" : ""}
        </span>
        <button
          type="submit"
          disabled={!canSave}
          title="Guardar (Ctrl+S)"
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg bg-violet-600 px-4 sm:ml-0 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
      </div>
    </form>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" });
}
