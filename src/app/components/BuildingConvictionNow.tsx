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
    <section className="bcn-module" aria-label="Building conviction now">
      <div className="bcn-header">
        <div>
          <span className="bcn-eyebrow">Public evidence</span>
          <h2 className="bcn-title">Building Conviction Now</h2>
        </div>
        <p className="bcn-lede">
          What changed, why it matters, and what deserves attention — before you track a ticker.
        </p>
      </div>
      <div className="bcn-list">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
      <p className="bcn-footnote">
        13F ownership signals are delayed disclosures and do not prove a manager still holds the position today.
      </p>
    </section>
  );
}
