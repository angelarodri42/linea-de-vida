# Memory Timeline

A personal, local-first timeline of life memories. Next.js (App Router) + Tailwind CSS v4 + SQLite (`better-sqlite3`).

## Setup

1. Install **Node.js 20 or 22 LTS** from https://nodejs.org (includes npm).
2. In this folder:

```bash
npm install
npm run dev
```

3. Open http://localhost:3000

The database is created automatically at `data/memories.db` on first run. Back up that file to back up your memories.

> If `npm install` fails building `better-sqlite3` on Windows, you are probably on a Node version without a prebuilt binary. Use a Node LTS version (20 or 22).

### Starting from scratch instead (equivalent)

```bash
npx create-next-app@15 memory-timeline --ts --tailwind --app --no-src-dir --no-eslint --import-alias "@/*"
cd memory-timeline
npm install better-sqlite3 lucide-react server-only
npm install -D @types/better-sqlite3
```

…then copy `lib/`, `components/`, `app/` and `next.config.mjs` from this project over the generated files.

## How it works

| Path | Purpose |
| --- | --- |
| `lib/db.ts` | SQLite init + all queries (settings, save, delete, move/swap) |
| `lib/types.ts` | Shared types and limits |
| `app/api/settings` | `GET` / `PUT` settings |
| `app/api/memories` | `GET` all, `POST` create-or-update by slot |
| `app/api/memories/[id]` | `DELETE` |
| `app/api/memories/move` | `POST { id, to_year, to_position }` — move or swap |
| `components/MemoryTimeline.tsx` | Main client view: state, drag & drop, optimistic updates |
| `components/SettingsBar.tsx` | Years / squares-per-year controls |
| `components/MemorySquare.tsx` | One slot with hover tooltip |
| `components/SidePanel.tsx` | Slide-out editor |

- **Non-destructive settings:** memories are stored by `(year_index, position_index)` and never rewritten when settings change. Increasing values just adds empty slots. Decreasing below a slot that holds a memory is refused (the UI shows the minimum), so nothing is ever hidden or lost.
- **Drag & drop:** drop on an empty square to move; drop on a filled square to swap the two. The swap runs in a single SQLite transaction.
- **Shortcuts:** `Ctrl+S` / `Ctrl+Enter` saves in the panel, `Esc` closes it, mouse wheel scrolls the timeline sideways.
