# Línea de Recuerdos

A personal timeline of life memories, in Spanish. Next.js (static export) + Tailwind CSS v4.

**All data stays on the visitor's device.** Memories are saved in the browser (IndexedDB). There is no server or database, so the site can be hosted for free on Netlify, and you never store anyone's personal data.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Netlify

The repo includes `netlify.toml` (build `npm run build`, publish `out/`).

1. In Netlify: **Add new site → Import an existing project → GitHub** and pick this repo.
2. Keep the detected settings and deploy. Every push to `main` redeploys automatically.

To test the production build locally: `npm run build` then `npm run preview`.

## Keeping memories safe

Browser storage can be cleared (by the user, or by Safari after ~7 days of Safari use without visiting the site). The app protects against this with:

- **Exportar / Importar** — download all memories as a `.json` file and load it back later or on another device.
- **Backup reminder** — a banner appears when there's no backup or the last one is over 14 days old.
- **Installable app (PWA)** — on iPhone, "Add to Home Screen" (the app shows a tip). Works offline.
- **Persistent storage request** — asks the browser not to evict the data.

## Code map

| Path | Purpose |
| --- | --- |
| `lib/timeline.ts` | Pure rules: save, delete, move/swap, non-destructive settings |
| `lib/storage.ts` | IndexedDB persistence, cross-tab sync, persistence request |
| `lib/backup.ts` | Export / import file format and validation |
| `components/MemoryTimeline.tsx` | Main view: state, drag & drop, tap-to-move |
| `components/SettingsBar.tsx` | Settings, Exportar / Importar |
| `components/SidePanel.tsx` | Slide-out editor (Guardar, Mover, Eliminar) |
| `components/Notices.tsx` | Backup reminder and iPhone tip |
| `public/sw.js`, `public/manifest.webmanifest` | Offline support and install metadata |

Backup file format (`version: 1`):

```json
{
  "app": "linea-de-vida",
  "version": 1,
  "exported_at": "2026-10-20T12:00:00.000Z",
  "settings": { "total_years": 30, "squares_per_year": 10, "show_calendar_year": false, "start_year": 2000 },
  "memories": [
    { "year_index": 0, "position_index": 0, "title": "…", "content": "…", "created_at": "…" }
  ]
}
```
