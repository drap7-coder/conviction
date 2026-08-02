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
        hideMeta
        eyebrow={item.subject}
        conclusion={item.conclusion}
        evidence={item.evidence}
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
  const items = getBuildingConvictionItems(5);
  if (items.length === 0) return null;

  return (
    <section className="bcn-module bcn-module-nested" aria-label="What’s changing now">
      <div className="bcn-header">
        <h2 className="bcn-title">What’s changing</h2>
      </div>
      <div
        className="bcn-list"
        role="region"
        aria-roledescription="carousel"
        aria-label="What’s changing cards"
        tabIndex={0}
      >
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
