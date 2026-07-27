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
        dateLabel={item.dateLabel}
        source={item.sourceLabel}
        strength={item.strength}
      />
    </Link>
  );
}

/**
 * Public evidence feed — server-rendered so visitors see real product
 * intelligence immediately. Kept short and scannable.
 */
export function BuildingConvictionNow() {
  const items = getBuildingConvictionItems(3);
  if (items.length === 0) return null;

  return (
    <section className="bcn-module" aria-label="What’s changing now">
      <div className="bcn-header">
        <span className="bcn-eyebrow">Now</span>
        <h2 className="bcn-title">What’s changing</h2>
        <p className="bcn-lede">
          Ownership moves and news worth a closer look.
        </p>
      </div>
      <div className="bcn-list">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
      <p className="bcn-footnote">
        Fund filings can lag by weeks and may not match today’s holdings.
      </p>
    </section>
  );
}
