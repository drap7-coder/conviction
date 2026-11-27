import type { StockQuote } from '@/lib/market/quotes';
import { normalizeTenYear } from '@/lib/market/pulse-gauges';
import type { MarketNarrativeHeadline } from '@/lib/market/market-narratives';
export const SYMBOLS = ['SPY', 'QQQ', 'GLD', '^TNX', 'USO'];
export type Signal = { ticker: string; value: number | null; move: number | null; asOf: string | null; usable: boolean };
export type Brief = { signals: Record<string, Signal>; spread: number | null; divergence: boolean; headline: string; thesis: string[]; news: MarketNarrativeHeadline | null; date: string };
export const signed = (n: number | null) => n === null ? 'Unavailable' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
export const stamp = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET' : 'Quote time unavailable';
export function buildBrief(quotes: StockQuote[], news: MarketNarrativeHeadline | null, now: Date): Brief {
  const signals = Object.fromEntries(SYMBOLS.map(ticker => {
    const q = quotes.find(q => q.ticker === ticker);
    const time = q?.asOf ? Date.parse(q.asOf) : NaN;
    const valid = (n: number | null | undefined): number | null => typeof n === 'number' && Number.isFinite(n) ? n : null;
    const value = ticker === '^TNX' ? normalizeTenYear(valid(q?.price), null).last : valid(q?.price);
    // Use regular-session changes consistently, never mix premarket and regular moves.
    const usable = value !== null && value > 0 && Number.isFinite(time) && now.getTime() - time >= -60000 && now.getTime() - time <= 20 * 60000;
    return [ticker, { ticker, value, move: valid(q?.changePercent), asOf: Number.isFinite(time) ? q!.asOf : null, usable }];
  })) as Record<string, Signal>;
  const [spy, qqq, gold, oil, rate] = ['SPY','QQQ','GLD','USO','^TNX'].map(t => signals[t]);
  const comparable = (a: Signal, b: Signal) => a.usable && b.usable && a.move !== null && b.move !== null && Math.abs(Date.parse(a.asOf!) - Date.parse(b.asOf!)) <= 10 * 60000;
  const spread = comparable(qqq, gold) ? qqq.move! - gold.move! : null;
  const divergence = comparable(oil, spy) && oil.move! > 0 && spy.move! < 0;
  return { signals, spread, divergence, news, date: now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric', timeZone:'America/New_York' }),
    headline: divergence ? 'Oil climbs as stocks retreat. Stress-test the shoot.' : spread !== null ? spread === 0 ? 'Growth and gold are level. Let the project make its case.' : spread > 0 ? 'Growth has the edge. Make the financing earn its place.' : 'Defense has the edge. Protect the downside before the pitch.' : 'Price the money. Protect the shoot. Earn the audience.',
    thesis: [rate.usable ? `The 10-year Treasury stands at ${rate.value!.toFixed(2)}%; use it as a reference when revisiting financing assumptions, not as a quote for gap debt.` : 'The rates snapshot is delayed or unavailable; refresh lender terms before changing the financing plan.', spread !== null ? `QQQ is ${Math.abs(spread).toFixed(2)} percentage points ${spread >= 0 ? 'ahead of' : 'behind'} GLD on the regular-session move; treat that as a risk-budget prompt, not proof that buyers want a particular slate.` : 'Risk appetite is not confirmed by synchronized quotes; keep the safe-IP case and original-project upside case separate.', oil.usable && oil.move !== null ? `USO is ${signed(oil.move)}; stress-test travel and freight if that move persists, while testing audience demand independently of the tape.` : 'Energy data is delayed or unavailable; retain your logistics contingency and test audience demand independently of the tape.'] };
}
