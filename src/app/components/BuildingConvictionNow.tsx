import Link from "next/link";
import {
  getBuildingConvictionItems,
  type BuildingConvictionItem,
} from "@/lib/evidence/building-conviction";
import { SignalBlock } from "@/components/display/SignalBlock";

function ItemCard({ item }: { item: BuildingConvictionItem }) {
  return (
    <Link href={item.href} className="bcn-item">
      <SignalBlock
        compact
        eyebrow={item.subject}
        conclusion={item.conclusion}
        evidence={item.evidence}
        whyItMatters={item.whyItMatters}
        dateLabel={item.dateLabel}
        source={item.sourceLabel}
        strength={item.strength}
      />
    </Link>
  );
}

/**
 * Public homepage module — server-rendered so crawlers and first-time
 * visitors see real product evidence before entering a ticker.
 */
export function BuildingConvictionNow() {
  const items = getBuildingConvictionItems(5);
  if (items.length === 0) return null;

  return (
    <section className="bcn-module" aria-label="What’s changing now">
      <div className="bcn-header">
        <div>
          <span className="bcn-eyebrow">Live examples</span>
          <h2 className="bcn-title">What’s changing right now</h2>
        </div>
        <p className="bcn-lede">
          Real ownership moves and news — the same format you’ll see once you track a company.
        </p>
      </div>
      <div className="bcn-list">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
      <p className="bcn-footnote">
        Fund ownership filings can arrive weeks after quarter-end and may not reflect today’s holdings.
      </p>
    </section>
  );
}
