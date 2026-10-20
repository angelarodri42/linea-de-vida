"use client";

import { useEffect, useState } from "react";
import { CalendarRange, CalendarDays, Grid3x3, Check, Loader2, Download, Upload } from "lucide-react";
import { LIMITS, type Settings, type SizeSettings } from "@/lib/types";

type Props = {
  settings: Settings;
  minimums: SizeSettings;
  memoryCount: number;
  onApply: (next: Settings) => Promise<void>;
  onExport: () => void;
  onImport: () => void;
};

export default function SettingsBar({
  settings,
  minimums,
  memoryCount,
  onApply,
  onExport,
  onImport,
}: Props) {
  const [years, setYears] = useState(String(settings.total_years));
  const [squares, setSquares] = useState(String(settings.squares_per_year));
  const [showYear, setShowYear] = useState(settings.show_calendar_year);
  const [startYear, setStartYear] = useState(String(settings.start_year));
  const [busy, setBusy] = useState(false);

  // Keep the inputs in sync if settings change from elsewhere.
  useEffect(() => {
    setYears(String(settings.total_years));
    setSquares(String(settings.squares_per_year));
    setShowYear(settings.show_calendar_year);
    setStartYear(String(settings.start_year));
  }, [settings]);

  const y = Number(years);
  const s = Number(squares);
  const start = Number(startYear);
  const startYearInvalid =
    !Number.isInteger(start) || start < LIMITS.minStartYear || start > LIMITS.maxStartYear;
  const valid =
    Number.isInteger(y) &&
    Number.isInteger(s) &&
    y >= minimums.total_years &&
    y <= LIMITS.maxYears &&
    s >= minimums.squares_per_year &&
    s <= LIMITS.maxSquaresPerYear &&
    !startYearInvalid;
  const dirty =
    y !== settings.total_years ||
    s !== settings.squares_per_year ||
    showYear !== settings.show_calendar_year ||
    start !== settings.start_year;

  async function apply(e?: React.FormEvent) {
    e?.preventDefault();
    if (!valid || !dirty || busy) return;
    setBusy(true);
    try {
      await onApply({
        total_years: y,
        squares_per_year: s,
        show_calendar_year: showYear,
        start_year: start,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
      <div className="mr-auto">
        <h1 className="text-lg font-semibold tracking-tight">Línea de Recuerdos</h1>
        <p className="text-xs text-zinc-500">
          {memoryCount} {memoryCount === 1 ? "recuerdo" : "recuerdos"} en {settings.total_years} años
        </p>
        <div className="mt-1.5 flex gap-1">
          <button
            type="button"
            onClick={onExport}
            disabled={memoryCount === 0}
            title="Descarga un archivo con todos tus recuerdos"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:bg-transparent"
          >
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
          <button
            type="button"
            onClick={onImport}
            title="Carga un archivo de copia descargado antes"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-50"
          >
            <Upload className="h-3.5 w-3.5" /> Importar
          </button>
        </div>
      </div>

      <form onSubmit={apply} className="flex flex-wrap items-end gap-4">
        <NumberField
          icon={<CalendarRange className="h-4 w-4" />}
          label="Años"
          value={years}
          onChange={setYears}
          min={minimums.total_years}
          max={LIMITS.maxYears}
        />
        <NumberField
          icon={<Grid3x3 className="h-4 w-4" />}
          label="Casillas / año"
          value={squares}
          onChange={setSquares}
          min={minimums.squares_per_year}
          max={LIMITS.maxSquaresPerYear}
        />
        <div className="flex flex-col gap-1">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-500">
            <input
              type="checkbox"
              checked={showYear}
              onChange={(e) => setShowYear(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-violet-600"
            />
            <CalendarDays className="h-4 w-4" />
            Mostrar año, desde
          </label>
          <input
            type="number"
            inputMode="numeric"
            aria-label="Año inicial"
            min={LIMITS.minStartYear}
            max={LIMITS.maxStartYear}
            value={startYear}
            disabled={!showYear}
            onChange={(e) => setStartYear(e.target.value)}
            className={`h-9 w-28 rounded-lg border bg-white px-3 text-sm tabular-nums outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 ${
              startYearInvalid
                ? "border-rose-400 focus:ring-rose-200"
                : "border-zinc-300 focus:border-violet-500 focus:ring-violet-200"
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={!valid || !dirty || busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Aplicar
        </button>
      </form>
    </header>
  );
}

function NumberField(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
}) {
  const n = Number(props.value);
  const invalid = props.value !== "" && (!Number.isInteger(n) || n < props.min || n > props.max);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        {props.icon}
        {props.label}
        <span className="font-normal text-zinc-400">
          ({props.min}–{props.max})
        </span>
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={`h-9 w-28 rounded-lg border bg-white px-3 text-sm tabular-nums outline-none transition focus:ring-2 ${
          invalid
            ? "border-rose-400 focus:ring-rose-200"
            : "border-zinc-300 focus:border-violet-500 focus:ring-violet-200"
        }`}
        title={
          props.min > 1
            ? `No se puede bajar de ${props.min} sin ocultar recuerdos existentes`
            : undefined
        }
      />
    </label>
  );
}
