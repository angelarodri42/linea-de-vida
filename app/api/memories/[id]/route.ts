import { deleteMemory } from "@/lib/db";
import { handle, toInt } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/memories/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    deleteMemory(toInt(id, "id"));
    return { ok: true };
  });
}
