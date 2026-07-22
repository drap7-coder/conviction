"use client";

import { useMemo } from "react";
import { buildConvictionSnapshot, type BuildSnapshotInput } from "@/lib/conviction/canonical";
import type { ConvictionSnapshot } from "@/lib/conviction/canonical-types";
import { MODEL_VERSION } from "@/lib/conviction/model-version";

/**
 * Consume the canonical conviction snapshot from raw evidence data.
 *
 * This is the ONLY place where scoring/verdict calculation happens in client components.
 * Components that call this hook must never recalculate, reinterpret, or rename the score.
 */
export function useCanonicalSnapshot(input: BuildSnapshotInput): ConvictionSnapshot {
  return useMemo(() => buildConvictionSnapshot(input), [
    input.ticker,
    input.institutional,
    input.insider,
    input.earnings,
    input.political,
    input.historyPoints,
    input.quote,
    input.week52High,
    input.week52Low,
  ]);
}

export { MODEL_VERSION };
export type { ConvictionSnapshot, BuildSnapshotInput };