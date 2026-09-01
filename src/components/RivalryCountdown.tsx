"use client";

import { useEffect, useState } from "react";
import { rivalryCountdownLabel } from "@/lib/competitions/countdown";

export function RivalryCountdown({
  lockAt,
  periodEnd,
}: {
  lockAt: string;
  periodEnd: string;
}) {
  const [label, setLabel] = useState<string | null>(() =>
    rivalryCountdownLabel({
      lockAt: new Date(lockAt),
      periodEnd: new Date(periodEnd),
    }),
  );

  useEffect(() => {
    const lock = new Date(lockAt);
    const end = new Date(periodEnd);
    function tick() {
      setLabel(rivalryCountdownLabel({ lockAt: lock, periodEnd: end }));
    }
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [lockAt, periodEnd]);

  if (!label) return null;

  return (
    <p className="h2h-countdown" aria-live="polite">
      {label}
    </p>
  );
}
