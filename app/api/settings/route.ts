import { getSettings, getSettingsMinimums, updateSettings } from "@/lib/db";
import { handle, readJson, toInt } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/settings -> { settings, minimums }
export async function GET() {
  return handle(() => ({ settings: getSettings(), minimums: getSettingsMinimums() }));
}

// PUT /api/settings { total_years?, squares_per_year?, show_calendar_year?, start_year? }
export async function PUT(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const settings = updateSettings({
      total_years: body.total_years === undefined ? undefined : toInt(body.total_years, "total_years"),
      squares_per_year:
        body.squares_per_year === undefined
          ? undefined
          : toInt(body.squares_per_year, "squares_per_year"),
      show_calendar_year:
        body.show_calendar_year === undefined ? undefined : body.show_calendar_year === true,
      start_year: body.start_year === undefined ? undefined : toInt(body.start_year, "start_year"),
    });
    return { settings, minimums: getSettingsMinimums() };
  });
}
