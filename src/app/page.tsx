import { fetchStockQuotes } from '@/lib/market/quotes';
import { fetchMarketNarrativePulse } from '@/lib/market/market-narratives';
import { selectPulseHomeStories } from '@/lib/market/pulse-home';
import { primaryHeadline } from '@/lib/market/news-hero';
import { buildBrief, SYMBOLS } from '@/components/home/briefing';
import { ColdOpen } from '@/components/home/ColdOpen';
import { GreenlightMeter } from '@/components/home/GreenlightMeter';
import { FrictionPanel } from '@/components/home/FrictionPanel';
import { PowerShifts } from '@/components/home/PowerShifts';
import { ScenesToWatch } from '@/components/home/ScenesToWatch';
import s from '@/components/home/Producer.module.css';
export const revalidate = 300;
export default async function HomePage() {
  const [quotes, news] = await Promise.allSettled([fetchStockQuotes(SYMBOLS), fetchMarketNarrativePulse(new Map())]);
  const now = new Date();
  const top = news.status === 'fulfilled' ? selectPulseHomeStories(news.value.themes, now.getTime()).todaysBrief[0] : null;
  const brief = buildBrief(quotes.status === 'fulfilled' ? quotes.value : [], top ? primaryHeadline(top) : null, now);
  return <main className={s.page}><ColdOpen brief={brief} /><GreenlightMeter brief={brief} /><FrictionPanel brief={brief} /><PowerShifts /><ScenesToWatch brief={brief} /><footer className={s.footer}>Producer lenses are conditional planning prompts, not observed deal terms or investment recommendations. Yahoo chart quotes may be delayed. Regular-session changes use each instrument’s previous close; spreads require quote times within 10 minutes and no older than 20 minutes. Older values remain labeled but do not drive the thesis. <a href="/pulse">Open the full tape →</a></footer></main>;
}
