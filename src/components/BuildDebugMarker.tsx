"use client";

import { useSearchParams } from "next/navigation";
import { formatBuildId, isDebugQuery, resolvePublicBuildId } from "@/lib/build-id";

export function BuildDebugMarker() {
  const searchParams = useSearchParams();
  if (!isDebugQuery(searchParams.get("debug"))) return null;

  const id = formatBuildId(resolvePublicBuildId());

  return (
    <footer className="app-build-debug" data-build={id}>
      {id}
    </footer>
  );
}
