import Link from "next/link";
import {
  getBuildingConvictionItems,
  type BuildingConvictionItem,
} from "@/lib/evidence/building-conviction";
import {
  EVIDENCE_STRENGTH_LABEL,
  EVIDENCE_STRENGTH_TONE,
} from "@/lib/display/vocabulary";

function ItemCard({ item }: { item: BuildingConvictionItem }) {
  const tone = EVIDENCE_STRENGTH_TONE[item.strength];

  return (
    <Link href={item.href} className={`bcn-item bcn-item-${tone}`}>
      <div className="bcn-item-top">
        <span className="bcn-subject">{item.subject}</span>
        <span className={`bcn-strength bcn-strength-${tone}`}>
          {EVIDENCE_STRENGTH_LABEL[item.strength]}
        </span>
      </div>
      <strong className="bcn-conclusion">{item.conclusion}</strong>
      <p className="bcn-evidence">{item.evidence}</p>
      <p className="bcn-why">{item.whyItMatters}</p>
      <div className="bcn-meta">
        <span>{item.dateLabel}</span>
        <span aria-hidden="true">·</span>
        <span>{item.sourceLabel}</span>
      </div>
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
