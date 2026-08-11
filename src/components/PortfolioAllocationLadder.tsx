import Link from "next/link";

export interface PortfolioAllocationItem {
  ticker: string;
  companyName: string;
  weight: number;
  marketValue: string;
  dailyChange: string;
  dailyChangeValue: number | null;
}

function allocationTone(weight: number) {
  if (weight > 20) return "high";
  if (weight >= 12) return "watch";
  return "balanced";
}

export function PortfolioAllocationLadder({ items }: { items: PortfolioAllocationItem[] }) {
  if (items.length === 0) return null;
  const visible = items.slice(0, 10);

  return (
    <section className="pf-allocation-ladder" aria-label="Portfolio allocation ladder">
      <div className="pf-allocation-heading">
        <div>
          <span className="pf-section-eyebrow">Capital map</span>
          <h2>Allocation ladder</h2>
        </div>
        <p>Position weight on a 0–25% risk scale. The markers show 12% watch and 20% concentration thresholds.</p>
      </div>
      <div className="pf-allocation-list">
        {visible.map((item, index) => {
          const tone = allocationTone(item.weight);
          const fill = Math.min(100, (item.weight / 25) * 100);
          return (
            <article className={`pf-allocation-row tone-${tone}`} key={item.ticker}>
              <span className="pf-allocation-rank">{String(index + 1).padStart(2, "0")}</span>
              <Link href={`/companies/${item.ticker}`} className="pf-allocation-company">
                <strong>{item.ticker}</strong>
                <span>{item.companyName}</span>
              </Link>
              <div className="pf-allocation-gauge" aria-label={`${item.ticker} is ${item.weight.toFixed(1)}% of portfolio`}>
                <i className="pf-allocation-threshold is-watch" />
                <i className="pf-allocation-threshold is-high" />
                <span style={{ width: `${fill}%` }} />
              </div>
              <strong className="pf-allocation-weight">{item.weight.toFixed(1)}%</strong>
              <div className="pf-allocation-values">
                <strong>{item.marketValue}</strong>
                <span className={item.dailyChangeValue !== null && item.dailyChangeValue < 0 ? "down" : "up"}>{item.dailyChange}</span>
              </div>
            </article>
          );
        })}
      </div>
      {items.length > visible.length ? (
        <p className="pf-allocation-more">Showing the 10 largest of {items.length} positions.</p>
      ) : null}
    </section>
  );
}
