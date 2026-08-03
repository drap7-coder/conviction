import type { NewsDriver } from "@/lib/evidence/news-driver";
import {
  buildMoveDriverView,
  type MoveDriverHeadline,
} from "@/lib/evidence/move-driver-brief";
import { SignalBlock } from "@/components/display/SignalBlock";

export type NewsBriefHeadline = MoveDriverHeadline;

export function NewsDriverBrief({
  ticker,
  companyName,
  driver,
  headlines,
  compact = false,
  /** Hide catalyst chip when the page header already shows it. */
  showBadge = true,
  /** Kept for callers; company dashboard always omits this fluff. */
  showWhy = false,
  /** Override eyebrow; pass null to omit (section title lives outside). */
  eyebrow = null,
  absChangePercent = null,
  now,
}: {
  ticker: string;
  companyName?: string;
  driver: NewsDriver | null;
  headlines: NewsBriefHeadline[];
  compact?: boolean;
  showBadge?: boolean;
  showWhy?: boolean;
  eyebrow?: string | null;
  absChangePercent?: number | null;
  now?: Date;
}) {
  void showWhy;

  const view = buildMoveDriverView({
    ticker,
    companyName,
    driver,
    headlines,
    absChangePercent,
    showBadge,
    now,
  });

  if (view.mode === "hidden") {
    return null;
  }

  if (view.mode === "no_catalyst") {
    return (
      <SignalBlock
        compact={compact}
        eyebrow={eyebrow}
        conclusion={view.conclusion}
        hideMeta
      />
    );
  }

  return (
    <SignalBlock
      compact={compact}
      eyebrow={eyebrow}
      conclusion={view.conclusion}
      evidence={view.evidence}
      dateLabel={view.dateLabel}
      source="material_news"
      badge={view.badge}
      hideMeta={compact}
    >
      {!compact && view.headlines.length > 0 ? (
        <ol className="signal-block-list" aria-label={`${ticker} related headlines`}>
          {view.headlines.map((item) => (
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
