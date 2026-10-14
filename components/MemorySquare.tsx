"use client";

import type { Memory } from "@/lib/types";

type Props = {
  year: number;
  position: number;
  memory?: Memory;
  selected: boolean;
  isDragSource: boolean;
  isDragOver: boolean;
  dragging: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
};

export default function MemorySquare({
  year,
  position,
  memory,
  selected,
  isDragSource,
  isDragOver,
  dragging,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  const filled = !!memory;

  const base =
    "group relative h-7 w-7 shrink-0 rounded-md outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2";
  const look = filled
    ? "cursor-grab bg-linear-to-br from-violet-500 to-fuchsia-500 shadow-sm shadow-fuchsia-500/30 hover:-translate-y-0.5 hover:shadow-md hover:shadow-fuchsia-500/40 active:cursor-grabbing"
    : "cursor-pointer bg-zinc-200/80 hover:bg-zinc-300";
  const state = [
    selected && "ring-2 ring-violet-600 ring-offset-2 ring-offset-white",
    isDragOver && "scale-115 ring-2 ring-amber-400 ring-offset-2",
    isDragSource && "opacity-35",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      aria-label={
        filled
          ? `Año ${year + 1}, casilla ${position + 1}: ${memory.title}`
          : `Año ${year + 1}, casilla ${position + 1}: vacía`
      }
      draggable={filled}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`${base} ${look} ${state}`}
    >
      {filled && !dragging && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 max-w-56 -translate-x-1/2 translate-y-1 truncate whitespace-nowrap rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
        >
          {memory.title}
        </span>
      )}
    </button>
  );
}
