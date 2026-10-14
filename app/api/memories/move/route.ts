import { moveMemory } from "@/lib/db";
import { handle, readJson, toInt } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/memories/move { id, to_year, to_position } -> Memory[] (the moved memory, plus the swapped one if any)
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return moveMemory(
      toInt(body.id, "id"),
      toInt(body.to_year, "to_year"),
      toInt(body.to_position, "to_position")
    );
  });
}
