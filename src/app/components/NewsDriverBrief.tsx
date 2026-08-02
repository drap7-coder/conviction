import type { NewsDriver } from "@/lib/evidence/news-driver";
import { deriveTodayCatalyst } from "@/lib/evidence/today-catalyst";
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

function sameHeadline(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function NewsDriverBrief({
  ticker,
  companyName,
  driver,
  headlines,
  compact = false,
  /** Hide catalyst chip when the page header already shows it. */
  showBadge = true,
  /** Extra “why it matters” line — usually off on the company dashboard. */
  showWhy = true,
  /** Override eyebrow; pass null to omit (section title lives outside). */
  eyebrow = "What’s driving the move",
}: {
  ticker: string;
  companyName?: string;
  driver: NewsDriver | null;
  headlines: NewsBriefHeadline[];
  compact?: boolean;
  showBadge?: boolean;
  showWhy?: boolean;
  eyebrow?: string | null;
}) {
  if (!driver && headlines.length === 0) {
    return (
      <SignalBlock
        compact={compact}
        eyebrow={eyebrow}
        conclusion="No clear news catalyst found"
        evidence="Ownership filings and company disclosures still show the fuller picture."
        dateLabel="—"
        source="material_news"
      />
    );
  }

  const topHeadlines = headlines.slice(0, 3);
  const catalyst = deriveTodayCatalyst(
    topHeadlines.map((h) => ({ headline: h.headline, date: h.date })),
    driver?.label,
    { ticker, companyName },
  );

  const conclusion = driver?.label ?? topHeadlines[0]?.headline ?? "Still gathering the story";
  // Prefer driver explanation; avoid repeating the same headlines we list below.
  const evidence = driver?.explanation
    ?? (compact && topHeadlines[1]
      ? topHeadlines.slice(0, 2).map((h) => h.headline).join(" · ")
      : null);
  const whyItMatters = !showWhy || compact
    ? null
    : driver
      ? "News helps explain the move — check ownership filings before deciding."
      : "Headlines are clues. Confirm with ownership and company filings before deciding.";

  // Don't re-list the conclusion as headline #1.
  const listHeadlines = topHeadlines.filter((item) => !sameHeadline(item.headline, conclusion));

  return (
    <SignalBlock
      compact={compact}
      eyebrow={eyebrow}
      conclusion={conclusion}
      evidence={evidence}
      whyItMatters={whyItMatters}
      dateLabel={newestDate(topHeadlines) ?? "Recent"}
      source="material_news"
      badge={showBadge && catalyst ? { label: catalyst.label, tone: catalyst.tone } : null}
    >
      {!compact && listHeadlines.length > 0 ? (
        <ol className="signal-block-list" aria-label={`${ticker} latest headlines`}>
          {listHeadlines.map((item) => (
            <li key={`${item.date}-${item.headline}`}>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.headline}
                </a>
              ) : (
                item.headline
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </SignalBlock>
  );
}
