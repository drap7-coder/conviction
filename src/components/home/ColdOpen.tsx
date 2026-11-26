import type { Brief } from './briefing';
import { signed, stamp } from './briefing';
import s from './Producer.module.css';
export function ColdOpen({ brief }: { brief: Brief }) {
  const rate = brief.signals['^TNX'];
  return <header><div className={s.dateline}><span>Daily Briefing · Producer Edition · ET</span><time>{brief.date}</time></div><p className={s.kicker}>01 / The hook</p><h1 className={s.headline}>{brief.headline}</h1><div className={s.thesis}><h2>Slate impact</h2><p>{brief.thesis.join(' ')}</p></div><div className={s.strip}>{[
    { title:'Cost of capital', value:rate.value === null ? 'Unavailable' : `${rate.value.toFixed(2)}%`, detail:'10Y Treasury · yield, not a loan offer', signal:rate },
    { title:'Risk appetite', value:`SPY ${signed(brief.signals.SPY.move)} / QQQ ${signed(brief.signals.QQQ.move)}`, detail:'Regular-session moves · not audience demand', signal:brief.signals.SPY },
    { title:'Physical friction', value:`USO ${signed(brief.signals.USO.move)}`, detail:'Oil ETF proxy · not spot crude', signal:brief.signals.USO },
  ].map(item => <article key={item.title}><h3>{item.title}</h3><strong className={s.number}>{item.value}</strong><p>{item.detail}</p><small>{item.signal.usable ? 'Snapshot' : 'Delayed / unavailable'} · {stamp(item.signal.asOf)}{item.title === 'Risk appetite' ? ` · QQQ ${stamp(brief.signals.QQQ.asOf)}` : ''}</small></article>)}</div></header>;
}
