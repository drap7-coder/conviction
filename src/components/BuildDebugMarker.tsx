"use client";

import { useSearchParams } from "next/navigation";
import { formatBuildId, isDebugQuery } from "@/lib/build-id";

export function BuildDebugMarker({ buildId }: { buildId: string }) {
  const searchParams = useSearchParams();
  if (!isDebugQuery(searchParams.get("debug"))) return null;

  const id = formatBuildId(buildId);

  return (
    <footer className="app-build-debug" data-build={id}>
      {id}
    </footer>
  );
}
