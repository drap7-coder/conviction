import { PulseBoard } from "@/components/market/PulseBoard";
import { loadPulseData, type PulseData } from "@/lib/market/pulse-data";

export const revalidate = 300;

type PulseView = "markets" | "movers" | "crypto" | "international";

function parsePulseView(value: string | null | undefined): PulseView {
  if (value === "movers" || value === "crypto" || value === "international") return value;
  return "markets";
}

/**
 * SSR cache-first Pulse: paint gauges/scoreboards from `unstable_cache`, then
 * the client board soft-refreshes on visibility / 5m without clearing the UI.
 */
export default async function MarketPulsePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  let initialData: PulseData | null = null;
  try {
    initialData = await loadPulseData();
  } catch {
    initialData = null;
  }

  return (
    <PulseBoard
      initialData={initialData}
      initialView={parsePulseView(params.view)}
    />
  );
}
