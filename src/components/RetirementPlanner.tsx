"use client";

import { useState } from 'react';
import { usePortfolioData } from '@/components/PortfolioData';
import { getLivePrice } from '@/lib/market/live-quote';
import { DEFAULT_RETIREMENT, INPUT_LIMITS, retirementScenarios, validateRetirement, type RetirementInputs } from '@/lib/retirement/model';
import styles from './RetirementPlanner.module.css';

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const labels: Record<keyof RetirementInputs, string> = {
  currentAge: 'Your age', retirementAge: 'Retire at age', endAge: 'Plan through age', savings: 'Retirement savings today ($)',
  monthlySavings: 'Monthly savings ($)', annualSpending: 'Yearly retirement spending ($)', socialSecurity: 'Social Security per year ($)',
  socialSecurityAge: 'Start Social Security at age', pension: 'Pension per year ($)', rentalIncome: 'Net rental income per year ($)',
  preReturn: 'Return before retirement (%)', postReturn: 'Return in retirement (%)', inflation: 'Inflation (%)', withdrawalRate: 'Initial withdrawal assumption (%)',
};
const initialFields = () => Object.fromEntries(Object.entries(DEFAULT_RETIREMENT).map(([key, value]) => [key, String(value)])) as Record<keyof RetirementInputs, string>;

export function RetirementPlanner() {
  const [fields, setFields] = useState(initialFields);
  const [exploreAge, setExploreAge] = useState<number | null>(null);
  const [imported, setImported] = useState(false);
  const { data, quotes, positions } = usePortfolioData();
  const input = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim() === '' ? NaN : Number(value)])) as unknown as RetirementInputs;
  const errors = validateRetirement(input);
  const scenarios = errors.length ? null : retirementScenarios(input);
  const base = scenarios?.[1];
  // Always use personal holdings, never the active sample/study book. Incomplete prices cannot seed a plan.
  const priced = positions.map(position => {
    const quote = quotes.find(item => item.ticker.toUpperCase() === position.ticker.toUpperCase());
    const price = quote ? getLivePrice(quote).price : null;
    return price != null && Number.isFinite(price) && price > 0 && Number.isFinite(position.shares) && position.shares > 0 ? price * position.shares : null;
  });
  const portfolioValue = !data.loading && !data.error && priced.length > 0 && priced.every(value => value !== null) ? (priced as number[]).reduce((sum, value) => sum + value, 0) : null;
  function update(key: keyof RetirementInputs, value: string) {
    setFields(previous => ({ ...previous, [key]: value }));
    if (key === 'savings') setImported(false);
  }
  function field(key: keyof RetirementInputs, slider = false) {
    const [min, max] = INPUT_LIMITS[key];
    return <div className={styles.field} key={key}>
      <label htmlFor={`retirement-${key}`}>{labels[key]}</label>
      <input id={`retirement-${key}`} type="number" inputMode="decimal" min={min} max={max} step={key.endsWith('Age') ? 1 : 'any'} value={fields[key]} onChange={event => update(key, event.target.value)} />
      {slider ? <input aria-label={`${labels[key]} slider`} type="range" min={key === 'retirementAge' ? Math.max(18, Number.isFinite(input.currentAge) ? input.currentAge : 18) : 0} max={key === 'retirementAge' ? 100 : Math.max(5000, Number.isFinite(input.monthlySavings) ? input.monthlySavings : 5000)} step={key === 'retirementAge' ? 1 : 50} value={Number.isFinite(input[key]) ? input[key] : min} onChange={event => update(key, event.target.value)} /> : null}
    </div>;
  }
  const maxBalance = scenarios ? Math.max(1, ...scenarios.flatMap(scenario => scenario.points.map(point => point.balance))) : 1;
  const x = (age: number) => 45 + (age - input.currentAge) / (input.endAge - input.currentAge) * 700;
  const y = (balance: number) => 210 - balance / maxBalance * 180;

  const selectedAge = base ? Math.max(input.currentAge, Math.min(input.endAge, exploreAge ?? input.retirementAge)) : 0;
  const selectedPoint = base?.points.find(point => point.age === selectedAge);
  const targetProgress = base && base.target > 0 ? base.projected / base.target * 100 : null;

  return <section className={styles.planner} aria-labelledby="retirement-title">
    <header className={styles.header}><p className={styles.kicker}>Your next chapter</p><h2 id="retirement-title">What could retirement look like?</h2><p>Try an age. Adjust your savings. See how the picture changes.</p><p className={styles.note}>Illustrative starting assumptions—replace them with your own. All amounts below are in today’s dollars. Inputs stay in this view and are not saved or sent to a planning service.</p><nav className={styles.jumpLinks} aria-label="Planning sections"><a href="#retirement-projection">Explore your future ↓</a></nav></header>
    <div className={styles.layout}>
      <div className={styles.controls}>
        <section className={styles.card} aria-labelledby="retirement-start"><h3 id="retirement-start">Start with you</h3><div className={styles.fields}>{field('currentAge')}{field('endAge')}{field('retirementAge', true)}{field('savings')}{field('monthlySavings', true)}{field('annualSpending')}</div>
          <button type="button" disabled={portfolioValue === null || portfolioValue > INPUT_LIMITS.savings[1]} onClick={() => { update('savings', String(Math.round(portfolioValue!))); setImported(true); }}>Use my holdings value{portfolioValue !== null ? ` · ${money(portfolioValue)}` : ''}</button>
          <p className={styles.note} role="status">{imported ? 'Copied your current quoted holdings value. Add other retirement savings manually; this figure will not auto-update.' : portfolioValue === null ? 'Add holdings and load all their prices to use this shortcut. You can always enter savings yourself.' : 'Optional snapshot of tracked holdings, not your total net worth. Quotes may be delayed.'}</p>
        </section>
        <details className={styles.card}><summary>Income beyond your investments</summary><p className={styles.note}>Use your own estimates; zero means none assumed. Pension and net rental income start at retirement. All three are assumed to keep pace with inflation.</p><div className={styles.fields}>{field('socialSecurity')}{field('socialSecurityAge')}{field('pension')}{field('rentalIncome')}</div><a href="https://www.ssa.gov/benefits/retirement/planner/AnypiaApplet.html" target="_blank" rel="noopener noreferrer">Get a Social Security estimate in today’s dollars ↗</a></details>
        <details className={styles.card}><summary>Growth, inflation & withdrawals</summary><p className={styles.note}>Annual return assumptions are after fees, before tax. Lower and higher scenarios vary both returns by two percentage points; these are examples, not confidence intervals.</p><div className={styles.fields}>{field('preReturn')}{field('postReturn')}{field('inflation')}{field('withdrawalRate')}</div></details>
      </div>
      <div id="retirement-projection" className={styles.results}>
        {errors.length ? <div className={styles.card} role="alert"><h3>Let’s check those inputs</h3><ul>{errors.map(error => <li key={error}>{Object.entries(labels).reduce((message, [key, label]) => message.replace(key, label), error)}</li>)}</ul></div> : base && scenarios ? <>
          <section className={styles.card} aria-labelledby="retirement-result"><p className={styles.kicker}>Under your assumptions</p><h3 id="retirement-result">{base.gap > 0 ? 'There’s a savings gap to explore.' : base.depletedAge !== null ? 'The target is met, but the money may run short.' : 'This scenario covers your plan.'}</h3><p className={styles.note}>A projection, not a promise. Real returns vary, and losses early in retirement can change the outcome.</p>
            <div className={styles.targetOverview}><div className={styles.progressRing} style={{ background: `conic-gradient(var(--accent) ${Math.min(100, targetProgress ?? 100)}%, var(--border) 0)` }}><div><strong>{targetProgress === null ? '—' : `${Math.round(targetProgress)}%`}</strong><span>of initial target</span></div></div><p className={styles.note}>{targetProgress === null ? 'Outside income covers the first year’s modeled spending.' : 'Projected savings compared with your first-year withdrawal target.'}<br />This is not a probability of success.</p></div>
            <div className={styles.metrics}><div><span>Projected at {input.retirementAge}</span><strong>{money(base.projected)}</strong></div><div><span>First-year withdrawal target</span><strong>{money(base.target)}</strong></div><div><span>{base.gap > 0 ? 'Gap to that target' : 'Above that target'}</span><strong>{money(Math.abs(base.gap))}</strong></div></div>
            <p>{base.depletedAge !== null ? `The model cannot cover all planned spending from about age ${base.depletedAge.toFixed(1)}.` : `The model covers planned spending through age ${input.endAge}, ending with ${money(base.endingBalance)}.`}</p>
            {base.gap > 0 ? <p>{base.extraMonthly === null ? 'There is no accumulation period left in this scenario. Try changing spending, income or retirement timing.' : `${money(base.extraMonthly)} more per month would close the withdrawal-target gap under these assumptions. It does not guarantee funding through age ${input.endAge}.`}</p> : null}
          </section>
          <figure className={styles.card}><h3>Your future, in perspective</h3><p className={styles.note}>Savings grow before retirement, then fund spending. Today’s dollars · USD.</p>
            <div className={styles.axis}><span>Balance · $0 at bottom</span><span>Scale up to {money(maxBalance)}</span></div>
            <svg className={styles.chart} viewBox="0 0 800 250" role="img" aria-label={`Three illustrative savings paths from age ${input.currentAge} to ${input.endAge}. Full values are in the scenario table and yearly breakdown below.`}>
              {[0, .5, 1].map(fraction => <g key={fraction}><line x1="45" x2="745" y1={y(maxBalance * fraction)} y2={y(maxBalance * fraction)} className={styles.grid} /></g>)}
              <line x1={x(input.retirementAge)} x2={x(input.retirementAge)} y1="25" y2="210" className={styles.retirementLine} />
              {scenarios.map((scenario, index) => <path key={scenario.label} d={scenario.points.map((point, i) => `${i ? 'L' : 'M'}${x(point.age)} ${y(point.balance)}`).join(' ')} className={`${styles.path} ${styles[`path${index}`]}`} />)}
              {selectedPoint ? <g><line x1={x(selectedAge)} x2={x(selectedAge)} y1="25" y2="210" stroke="var(--accent)" opacity=".4" /><circle cx={x(selectedAge)} cy={y(selectedPoint.balance)} r="5" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" /></g> : null}
            </svg><div className={styles.axis}><span>Start {input.currentAge}</span><span>Retire {input.retirementAge} · vertical line</span><span>Through {input.endAge}</span></div><figcaption className={styles.legend}><span>– – Lower returns</span><span>━ Your assumptions</span><span>··· Higher returns</span></figcaption>
            <div className={styles.explorer}><label htmlFor="explore-retirement-age">Explore your journey <strong>Age {selectedAge}</strong></label><input id="explore-retirement-age" type="range" min={input.currentAge} max={input.endAge} step="1" value={selectedAge} onChange={event => setExploreAge(Number(event.target.value))} /><output htmlFor="explore-retirement-age">{selectedPoint ? money(selectedPoint.balance) : '—'} <span>under your assumptions · {selectedAge < input.retirementAge ? 'saving years' : 'retirement years'}</span></output></div>
          </figure>
          <div className={styles.tableWrap}><table><caption>Compare the assumptions</caption><thead><tr><th>Scenario</th><th>Returns before / after</th><th>At retirement</th><th>Spending covered?</th></tr></thead><tbody>{scenarios.map(scenario => <tr key={scenario.label}><th scope="row">{scenario.label}</th><td>{scenario.preReturn}% / {scenario.postReturn}%</td><td>{money(scenario.projected)}</td><td>{scenario.depletedAge === null ? `Through ${input.endAge}` : `Short from ${scenario.depletedAge.toFixed(1)}`}</td></tr>)}</tbody></table></div>
          <details className={styles.card}><summary>Year-by-year balances</summary><div className={styles.tableWrap}><table><caption>Today's dollars · end-of-year values after the starting age</caption><thead><tr><th>Age</th>{scenarios.map(s => <th key={s.label}>{s.label}</th>)}</tr></thead><tbody>{base.points.map((point, index) => <tr key={point.age}><th scope="row">{point.age}</th>{scenarios.map(s => <td key={s.label}>{money(s.points[index].balance)}</td>)}</tr>)}</tbody></table></div></details>
        </> : null}
      </div>
    </div>
    <details className={styles.card}><summary>How this estimate works</summary><p>All displayed money is in today’s purchasing power. Effective monthly real returns remove inflation from the annual return assumptions. Contributions arrive at month-end until retirement; withdrawals occur at month-start afterward. Contributions, spending and outside income therefore rise with inflation in nominal dollars. Fixed pensions or rents may not behave this way.</p><p>The withdrawal target divides first-year spending not covered by outside income by your chosen initial withdrawal rate. The default 4% is a rule of thumb, not a safe-return guarantee. It does not change with the planning horizon; the separate spending projection does. Delayed Social Security is included only from the selected starting age. Extra savings shown close only the target gap.</p><p>Returns are smooth assumptions. Taxes, benefit eligibility, changing benefit laws, debt, healthcare shocks and the order of market gains and losses are not modeled. Include taxes and healthcare in your spending estimate. Net rent means after property costs; rental and other income are not guaranteed. Once savings cannot cover spending, the shortfall remains flagged even if later income reduces withdrawals.</p><p><a href="https://retirementcalculator.nga.finra.org/" target="_blank" rel="noopener noreferrer">FINRA retirement calculator and assumptions ↗</a> · <a href="https://www.ssa.gov/OACT/quickcalc/" target="_blank" rel="noopener noreferrer">Social Security estimates ↗</a></p></details>
  </section>;
}
