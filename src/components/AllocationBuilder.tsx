"use client";
import { useState } from 'react';
import { ASSET_CLASSES, contributionPreview } from '@/lib/retirement/allocation';
import styles from './RetirementPlanner.module.css';
const dollars = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parse = (s: string) => s.trim() ? Number(s) : NaN;
const presets = [[40, 50, 10], [60, 35, 5], [80, 15, 5]];
export function AllocationBuilder() {
  const [balances, setBalances] = useState(['0', '0', '0']);
  const [targets, setTargets] = useState(['60', '35', '5']);
  const [contribution, setContribution] = useState('500');
  const amounts = balances.map(parse);
  const weights = targets.map(parse);
  const budget = parse(contribution);
  const valid = [...amounts, budget].every(n => Number.isFinite(n) && n >= 0 && n <= 1e9) && weights.every(n => Number.isFinite(n) && n >= 0 && n <= 100) && Math.abs(weights.reduce((a, b) => a + b, 0) - 100) < 1e-6;
  const rows = valid ? contributionPreview(amounts, weights, budget) : null;
  const total = amounts.reduce((a, b) => a + b, 0);
  const stockEnd = valid ? weights[0] : 0;
  const bondEnd = valid ? weights[0] + weights[1] : 0;
  return <section id="allocation-builder" className={styles.allocation} aria-labelledby="allocation-title">
    <header className={styles.allocationHeader}><div><p className={styles.kicker}>Build with intention</p><h2 id="allocation-title">Give every new dollar a job.</h2><p>Explore a mix, then see how a contribution could move you toward it.</p></div><span className={styles.chip}>Educational sandbox</span></header>
    <p className={styles.note}>Separate from your retirement forecast. These examples do not select a suitable mix for you or change its return assumptions. Enter grouped balances yourself, including cash held outside IQBulls; nothing is imported, saved, or traded.</p>
    <div className={styles.allocationLayout}>
      <div><h3>1. Choose a mix to explore</h3><div className={styles.presets}>{presets.map(preset => <button key={preset[0]} type="button" aria-pressed={preset.every((n, i) => n === weights[i])} onClick={() => setTargets(preset.map(String))}>{preset[0]}% stocks<span>{preset[1]}% bonds · {preset[2]}% cash</span></button>)}</div>
        <p className={styles.note}>Illustrations only. Stocks carry market risk; bonds carry interest-rate and credit risk; cash can lose purchasing power. More categories do not automatically mean adequate diversification.</p>
        <div className={styles.mixInputs}>{ASSET_CLASSES.map((name, index) => <div key={name}><strong>{name}</strong><label>Current value ($)<input type="number" min="0" max="1000000000" step="any" aria-label={`${name} current value ($)`} value={balances[index]} onChange={event => setBalances(previous => previous.map((value, i) => i === index ? event.target.value : value))} /></label><label>Target (%)<input type="number" min="0" max="100" step="any" aria-label={`${name} target (%)`} value={targets[index]} onChange={event => setTargets(previous => previous.map((value, i) => i === index ? event.target.value : value))} /></label></div>)}</div>
        <label className={styles.field}>2. New money to allocate ($)<input type="number" min="0" max="1000000000" step="0.01" value={contribution} onChange={event => setContribution(event.target.value)} /></label>
        {!valid ? <p role="alert" className={styles.note}>Enter amounts from $0 to $1 billion and target percentages totaling exactly 100%.</p> : null}
      </div>
      <div className={styles.mixPreview}>{rows ? <>
        <div className={styles.mixOverview}><div className={styles.mixDonut} role="img" aria-label={`Target mix: ${weights[0]}% stocks, ${weights[1]}% bonds, ${weights[2]}% cash`} style={{ background: `conic-gradient(var(--accent) 0% ${stockEnd}%, #b8c9df ${stockEnd}% ${bondEnd}%, #677381 ${bondEnd}% 100%)` }}><div><strong>100%</strong><span>Your target</span></div></div><div className={styles.mixLegend}>{rows.map((row, i) => <p key={row.name}><i style={{ background: ['var(--accent)', '#b8c9df', '#677381'][i] }} /><span>{row.name}</span><strong>{row.target}%</strong></p>)}</div></div>
        <h3>3. Preview your next contribution</h3><p className={styles.note}>{total === 0 ? 'With no starting balances, new money follows the target percentages.' : 'New money goes toward underweight categories. A small contribution may leave the mix short of your target.'}</p>
        {rows.map((row, index) => <div className={styles.allocationRow} key={row.name}><div><strong>{row.name}</strong><strong>{dollars(row.add)}</strong></div><div className={styles.mixBar}><span style={{ width: `${row.afterPct}%`, background: ['var(--accent)', '#b8c9df', '#677381'][index] }} /><i style={{ left: `${row.target}%` }} /></div><p>{row.beforePct.toFixed(1)}% now → {row.afterPct.toFixed(1)}% after · target {row.target}%</p></div>)}
        <p className={styles.note}>Illustrative allocation of {dollars(Math.round(budget * 100) / 100)}. No sales modeled. Dollars are distributed in proportion to shortfalls against the target after adding your contribution, with rounding to cents.</p>
      </> : <p>Your mix preview appears when the inputs are valid.</p>}</div>
    </div>
    <details className={styles.efficiency}><summary>Build efficiently: what to check before investing</summary><div className={styles.efficiencyGrid}><article><h3>Look inside the funds</h3><p>Two funds can own many of the same companies. Check underlying holdings, geographic exposure and concentration—not just the number of funds.</p></article><article><h3>Check the full cost</h3><p>Compare expense ratios, account fees and trading costs. This preview does not calculate taxes, fund overlap or account-specific restrictions.</p></article><article><h3>Use your contribution plan</h3><p>New contributions can help restore a chosen mix without selling. Review your horizon, cash needs, and ability to handle losses before choosing that mix.</p></article></div><a href="https://www.investor.gov/additional-resources/general-resources/publications-research/info-sheets/beginners-guide-asset" target="_blank" rel="noopener noreferrer">Investor.gov: allocation, diversification and rebalancing ↗</a></details>
  </section>;
}
