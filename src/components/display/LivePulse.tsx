/**
 * ── LivePulse (shared) ──
 *
 * Reusable Live Pulse indicator.
 *
 * Behavior:
 *  - Neutral when connected and idle.
 *  - Briefly brightens only when fresh data arrives (via updateToken change).
 *  - Does not blink continuously.
 *  - Shows delayed or stale status when supported by metadata.
 *  - Does not imply real-time data if the provider is delayed.
 *  - Respects prefers-reduced-motion.
 *  - Does not animate on first render.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { Freshness } from "@/lib/display/types";
import { fmtFreshness } from "@/lib/display/format";

interface LivePulseProps {
  freshness: Freshness;
  lastUpdatedAt: string | null;
  /** Change this value to trigger a brief brighten */
  updateToken?: number | string;
  className?: string;
}

type PulseState = "idle" | "bright" | "delayed" | "stale" | "off";

export function LivePulse({
  freshness,
  lastUpdatedAt,
  updateToken,
  className = "",
}: LivePulseProps) {
  const [pulseState, setPulseState] = useState<PulseState>("idle");
  const isFirstRender = useRef(true);
  const previousToken = useRef(updateToken);

  // Determine base state from freshness
  useEffect(() => {
    if (freshness === "unavailable") {
      setPulseState("off");
      return;
    }
    if (freshness === "stale") {
      setPulseState("stale");
      return;
    }
    if (freshness === "delayed") {
      setPulseState("delayed");
      return;
    }
    if (freshness === "live" || freshness === "recent") {
      setPulseState("idle");
    }
  }, [freshness]);

  // Brief brighten on genuine update
  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousToken.current = updateToken;
      return;
    }

    // Only brighten if the token actually changed
    if (updateToken !== previousToken.current) {
      previousToken.current = updateToken;
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mediaQuery.matches) {
        setPulseState("bright");
        // Immediately settle back to idle without animation
        requestAnimationFrame(() => setPulseState("idle"));
        return;
      }

      setPulseState("bright");
      const timer = setTimeout(() => {
        setPulseState(
          freshness === "live" || freshness === "recent" ? "idle" : pulseState === "bright" ? "idle" : pulseState,
        );
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [updateToken, freshness]);

  const label = fmtFreshness(freshness);
  const isBright = pulseState === "bright";

  return (
    <span
      className={`live-pulse live-pulse-${pulseState} ${isBright ? "live-pulse-bright" : ""} ${className}`}
      role="status"
      aria-label={`Market data: ${label}`}
      title={`${label}${lastUpdatedAt ? ` · ${lastUpdatedAt}` : ""}`}
    >
      <span className="live-pulse-dot" aria-hidden="true" />
      <span className="live-pulse-label">{label}</span>
    </span>
  );
}