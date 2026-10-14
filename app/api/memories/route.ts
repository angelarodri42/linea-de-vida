import { listMemories, saveMemory } from "@/lib/db";
import { handle, readJson, toInt } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/memories -> Memory[]
export async function GET() {
  return handle(() => listMemories());
}

// POST /api/memories { year_index, position_index, title, content } -> Memory
// Creates the memory for that slot, or updates it if the slot is already filled.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return saveMemory({
      year_index: toInt(body.year_index, "year_index"),
      position_index: toInt(body.position_index, "position_index"),
      title: typeof body.title === "string" ? body.title : "",
      content: typeof body.content === "string" ? body.content : "",
    });
  });
}
