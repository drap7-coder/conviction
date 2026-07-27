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
        conclusion="No recent news loaded yet"
        evidence="Open the company page for ownership filings and more detail."
        dateLabel="—"
        source="material_news"
      />
    );
  }

  const conclusion = driver?.label ?? headlines[0]?.headline ?? "Still gathering the story";
  const evidence = driver?.explanation
    ?? (headlines[1] ? headlines.slice(0, 2).map((h) => h.headline).join(" · ") : null);
  const whyItMatters = compact
    ? null
    : driver
      ? "News helps explain the move — check ownership filings before deciding."
      : "Headlines are clues. Confirm with ownership and company filings before deciding.";

  return (
    <SignalBlock
      compact={compact}
      eyebrow="What’s driving the move"
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
