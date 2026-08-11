import Link from "next/link";
import type { SmartMoneyTone } from "@/lib/market/smart-money-brief";

export interface SmartMoneyRadarItem {
  ticker: string;
  label: string;
  detail: string;
  meta: string;
  href: string;
  tone: SmartMoneyTone;
}

export function SmartMoneyRadar({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: SmartMoneyRadarItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="smart-money-radar" aria-label={title}>
      <div className="smart-money-radar-heading">
        <div>
          <span>First read</span>
          <h3>{title}</h3>
        </div>
        <p>{subtitle}</p>
      </div>
      <div className={`smart-money-radar-grid item-count-${items.length}`}>
        {items.map((item, index) => (
          <Link href={item.href} className={`smart-money-radar-item tone-${item.tone}`} key={`${item.ticker}-${index}`}>
            <span className="smart-money-radar-rank">0{index + 1}</span>
            <div>
              <strong>{item.ticker}</strong>
              <em>{item.label}</em>
            </div>
            <p>{item.detail}</p>
            <small>{item.meta}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
