import s from './Producer.module.css';
export function PowerShifts() { return <section className={s.section}><div className={s.sectionHead}><p className={s.kicker}>04 / Leverage dynamics</p><h2>Cast of characters & power shifts</h2><span>Diligence questions, not claims about specific companies</span></div><div className={s.grid3}>{[
 ['Forced actors','Who has a clock?','Look for refinancing dates, delivery obligations and expiring rights. Verify the deadline before assuming a seller must accept a discount.'],
 ['Dry powder','Who can wait—and close?','Cash-rich buyers may gain leverage when others face deadlines. Compare certainty of funds, closing speed and retained rights, not just the headline price.'],
 ['Incumbents vs. disruptors','Who owns the audience?','Test legacy distribution reach against direct audience access and AI workflow savings. Verify rights, consent and delivery quality before counting a lower production cost.'],
 ].map(([label,title,copy])=><article key={label}><h3>{label}</h3><h4>{title}</h4><p>{copy}</p></article>)}</div></section>; }
