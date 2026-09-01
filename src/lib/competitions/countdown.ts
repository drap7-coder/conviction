export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

export function countdownParts(target: Date, now = new Date()): CountdownParts {
  const totalMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalMs };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** e.g. "2d 14h 08m" */
export function formatCountdownShort(parts: CountdownParts): string {
  if (parts.totalMs <= 0) return "0m";
  if (parts.days > 0) {
    return `${parts.days}d ${parts.hours}h ${pad(parts.minutes)}m`;
  }
  if (parts.hours > 0) {
    return `${parts.hours}h ${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
  }
  return `${parts.minutes}m ${pad(parts.seconds)}s`;
}

export type RivalryCountdownPhase = "lock" | "settlement" | "ended";

export function rivalryCountdownPhase(input: {
  lockAt: Date;
  periodEnd: Date;
  now?: Date;
}): RivalryCountdownPhase {
  const now = input.now ?? new Date();
  if (now >= input.periodEnd) return "ended";
  if (now >= input.lockAt) return "settlement";
  return "lock";
}

export function rivalryCountdownLabel(input: {
  lockAt: Date;
  periodEnd: Date;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  const phase = rivalryCountdownPhase({ lockAt: input.lockAt, periodEnd: input.periodEnd, now });
  if (phase === "ended") return null;
  if (phase === "lock") {
    const parts = countdownParts(input.lockAt, now);
    return `Locks in ${formatCountdownShort(parts)}`;
  }
  const parts = countdownParts(input.periodEnd, now);
  return `${formatCountdownShort(parts)} remaining until settlement`;
}
