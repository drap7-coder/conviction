"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One-shot running bull overlay. Triggered on accent changes (and optional
 * logo replay). Honors prefers-reduced-motion and never blocks interaction.
 */
export function RunningBull({
  playToken = 0,
}: {
  /** Increment to request a run. */
  playToken?: number;
}) {
  const [running, setRunning] = useState(false);
  const lastToken = useRef(0);
  const reduceMotion = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion.current = mq.matches;
    const sync = () => {
      reduceMotion.current = mq.matches;
    };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!playToken || playToken === lastToken.current) return;
    lastToken.current = playToken;
    if (reduceMotion.current) return;
    setRunning(false);
    const kick = window.requestAnimationFrame(() => setRunning(true));
    const done = window.setTimeout(() => setRunning(false), 1400);
    return () => {
      window.cancelAnimationFrame(kick);
      window.clearTimeout(done);
    };
  }, [playToken]);

  const onAnimationEnd = useCallback(() => setRunning(false), []);

  if (!running) return null;

  return (
    <div className="running-bull-layer" aria-hidden="true">
      <img
        className="running-bull is-running"
        src="/iqbulls-bull.png"
        alt=""
        onAnimationEnd={onAnimationEnd}
      />
    </div>
  );
}
