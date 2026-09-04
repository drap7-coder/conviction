import Link from "next/link";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { getSectorColor } from "@/lib/display/sector-colors";

export interface PortfolioAllocationItem {
  ticker: string;
  companyName: string;
  weight: number;
  /** Industry / exposure sleeve — colors the bar to match Sector Mix. */
  sector?: string | null;
  marketValue?: string;
  dailyChange?: string;
  dailyChangeValue?: number | null;
}

function dayMoveClass(change: number | null | undefined): "up" | "down" | "flat" {
  if (change == null || change === 0) return "flat";
  return change < 0 ? "down" : "up";
}

export function PortfolioAllocationLadder({
  items,
  eyebrow = "Concentration",
  title = "Position weight vs. risk thresholds",
  hint = "Bar color matches industry (Sector Mix). Markers at 12% watch and 20% concentrated.",
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
      className={`pf-allocation-ladder surface-shell${showValues ? "" : " is-weights-only"}`}
      aria-label="Portfolio allocation ladder"
    >
      <div className="pf-allocation-heading">
        <div>
          <span className="pf-section-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <p>{hint}</p>
      </div>
      <div className="pf-allocation-list surface-well">
        <div className="pf-allocation-scale" aria-hidden="true">
          <div className="pf-allocation-scale-track">
            <span className="is-watch">12% watch</span>
            <span className="is-high">20% concentrated</span>
          </div>
        </div>
        {visible.map((item, index) => {
          const fill = Math.min(100, (item.weight / 25) * 100);
          const color = getSectorColor(item.sector);
          return (
            <article
              className="pf-allocation-row"
              key={item.ticker}
              style={{ ["--allocation-color" as string]: color }}
            >
              <span className="pf-allocation-rank">{String(index + 1).padStart(2, "0")}</span>
              <span className="pf-allocation-logo" aria-hidden="true">
                <LogoDisplay ticker={item.ticker} size="card" />
              </span>
              <Link href={`/companies/${item.ticker}`} className="pf-allocation-company">
                <strong>{item.ticker}</strong>
                <span>{item.companyName}</span>
              </Link>
              <div className="pf-allocation-gauge" aria-label={`${item.ticker} is ${item.weight.toFixed(1)}% of portfolio`}>
                <i className="pf-allocation-threshold is-watch" />
                <i className="pf-allocation-threshold is-high" />
                <span style={{ width: `${fill}%` }} />
              </div>
              <strong className="pf-allocation-weight tnum">{item.weight.toFixed(1)}%</strong>
              {showValues ? (
                <div className="pf-allocation-values">
                  <strong className="tnum">{item.marketValue}</strong>
                  <span className={`tnum ${dayMoveClass(item.dailyChangeValue)}`}>
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
