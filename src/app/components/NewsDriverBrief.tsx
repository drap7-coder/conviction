import type { NewsDriver } from "@/lib/evidence/news-driver";
import { SignalBlock } from "@/components/display/SignalBlock";

export interface NewsBriefHeadline {
  headline: string;
  url: string | null;
  date: string;
}

function newestDate(headlines: NewsBriefHeadline[]): string | null {
  if (headlines.length === 0) return null;
  const sorted = [...headlines].sort((a, b) => b.date.localeCompare(a.date));
  const raw = sorted[0]?.date;
  if (!raw) return null;
  const d = new Date(`${raw}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NewsDriverBrief({
  ticker,
  driver,
  headlines,
  compact = false,
}: {
  ticker: string;
  driver: NewsDriver | null;
  headlines: NewsBriefHeadline[];
  compact?: boolean;
}) {
  if (!driver && headlines.length === 0) {
    return (
      <SignalBlock
        compact={compact}
        conclusion="Recent headlines unavailable"
        evidence="No material news driver is loaded for this name yet."
        dateLabel="—"
        source="material_news"
      />
    );
  }

  const conclusion = driver?.label ?? headlines[0]?.headline ?? "Story still forming";
  const evidence = driver?.explanation
    ?? (headlines[1] ? headlines.slice(0, 2).map((h) => h.headline).join(" · ") : null);
  const whyItMatters = driver
    ? "Treat this as context for the thesis — not as proof the thesis is confirmed or broken."
    : "Headlines are context. Confirm against ownership and fundamentals before changing conviction.";

  return (
    <SignalBlock
      compact={compact}
      eyebrow="Material news"
      conclusion={conclusion}
      evidence={evidence}
      whyItMatters={whyItMatters}
      dateLabel={newestDate(headlines) ?? "Recent"}
      source="material_news"
    >
      {headlines.length > 0 ? (
        <ol className="signal-block-list" aria-label={`${ticker} latest developments`}>
          {headlines.slice(0, 3).map((item) => (
            <li key={`${item.date}-${item.headline}`}>{item.headline}</li>
          ))}
        </ol>
      ) : null}
    </SignalBlock>
  );
}
