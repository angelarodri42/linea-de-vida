import { getSettings, listMemories } from "@/lib/db";
import MemoryTimeline from "@/components/MemoryTimeline";

export const dynamic = "force-dynamic";

// Server component: read straight from SQLite so the first paint already has data.
export default function Page() {
  return <MemoryTimeline initialSettings={getSettings()} initialMemories={listMemories()} />;
}
