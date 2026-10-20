"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { BACKUP_REMINDER_DAYS, daysSinceBackup } from "@/lib/backup";
import type { AppState } from "@/lib/types";

const IOS_TIP_KEY = "linea-de-vida:ios-tip-dismissed";

/** Banners under the header: backup reminder and the iPhone "add to home screen" tip. */
export default function Notices({ state, onExport }: { state: AppState; onExport: () => void }) {
  const [backupDismissed, setBackupDismissed] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos =
      /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(IOS_TIP_KEY) === "1";
    } catch {}
    setShowIosTip(isIos && !standalone && !dismissed);
  }, []);

  const days = daysSinceBackup(state);
  const needsBackup =
    state.memories.length > 0 && (days === null || days >= BACKUP_REMINDER_DAYS) && !backupDismissed;

  if (!needsBackup && !showIosTip) return null;

  return (
    <div className="flex flex-col">
      {needsBackup && (
        <Banner tone="amber" onClose={() => setBackupDismissed(true)}>
          <span>
            Tus recuerdos solo se guardan en este navegador.{" "}
            {days === null
              ? "Aún no has descargado ninguna copia."
              : `Tu última copia es de hace ${days} días.`}
          </span>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-900/10 px-2 py-1 text-xs font-semibold hover:bg-amber-900/20"
          >
            <Download className="h-3.5 w-3.5" /> Descargar copia
          </button>
        </Banner>
      )}
      {showIosTip && (
        <Banner
          tone="sky"
          onClose={() => {
            setShowIosTip(false);
            try {
              localStorage.setItem(IOS_TIP_KEY, "1");
            } catch {}
          }}
        >
          <span>
            En iPhone/iPad, añade esta página a tu pantalla de inicio (
            <Share className="inline h-3.5 w-3.5 align-[-2px]" /> Compartir → «Añadir a pantalla de
            inicio») para que Safari no borre tus recuerdos.
          </span>
        </Banner>
      )}
    </div>
  );
}

function Banner({
  tone,
  onClose,
  children,
}: {
  tone: "amber" | "sky";
  onClose: () => void;
  children: React.ReactNode;
}) {
  const colors =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-sky-200 bg-sky-50 text-sky-900";
  return (
    <div className={`flex items-center gap-3 border-b px-6 py-2 text-sm ${colors}`}>
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">{children}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar aviso"
        className="shrink-0 rounded p-1 opacity-60 transition hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
