import Link from "next/link";

export interface PortfolioAllocationItem {
  ticker: string;
  companyName: string;
  weight: number;
  marketValue?: string;
  dailyChange?: string;
  dailyChangeValue?: number | null;
}

function allocationTone(weight: number) {
  if (weight > 20) return "high";
  if (weight >= 12) return "watch";
  return "balanced";
}

function dayMoveClass(change: number | null | undefined): "up" | "down" | "flat" {
  if (change == null || change === 0) return "flat";
  return change < 0 ? "down" : "up";
}

export function PortfolioAllocationLadder({
  items,
  eyebrow = "Concentration",
  title = "Position weight vs. risk thresholds",
  hint = "Bar color is weight risk (12% watch · 20% concentrated) — not today’s move.",
}: {
  items: PortfolioAllocationItem[];
  eyebrow?: string;
  title?: string;
  hint?: string;
}) {
  if (items.length === 0) return null;
  const visible = items.slice(0, 10);
  const showValues = items.some((item) => item.marketValue || item.dailyChange);

  return (
    <section
      className={`pf-allocation-ladder${showValues ? "" : " is-weights-only"}`}
      aria-label="Portfolio allocation ladder"
    >
      <div className="pf-allocation-heading">
        <div>
          <span className="pf-section-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <p>{hint}</p>
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
              {showValues ? (
                <div className="pf-allocation-values">
                  <strong>{item.marketValue}</strong>
                  <span className={dayMoveClass(item.dailyChangeValue)}>
                    {item.dailyChange}
                    {item.dailyChange && item.dailyChange !== "—" ? (
                      <em className="pf-allocation-today"> today</em>
                    ) : null}
                  </span>
                </div>
              ) : null}
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
