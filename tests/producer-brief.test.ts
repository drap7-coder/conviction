import { describe, expect, it } from 'vitest';
import { buildBrief } from '@/components/home/briefing';
import type { StockQuote } from '@/lib/market/quotes';
const now = new Date('2026-11-25T16:00:00Z');
const quote = (ticker: string, changePercent: number, asOf = '2026-11-25T15:59:00Z') => ({ ticker, price: 100, changePercent, asOf } as StockQuote);
describe('producer briefing signal discipline', () => {
 it('falls back without fabricating signals', () => {
  const b=buildBrief([],null,now);
  expect(b.spread).toBeNull(); expect(b.divergence).toBe(false);
  expect(b.headline).toBe('Price the money. Protect the shoot. Earn the audience.');
 });
 it('compares synchronized regular changes in percentage points', () => {
  const b=buildBrief([quote('QQQ',2),quote('GLD',.5),quote('USO',1),quote('SPY',-1)],null,now);
  expect(b.spread).toBe(1.5); expect(b.divergence).toBe(true);
 });
 it('keeps stale numbers but suppresses conclusions', () => {
  const b=buildBrief([quote('QQQ',2,'2026-11-24T15:59:00Z'),quote('GLD',.5)],null,now);
  expect(b.signals.QQQ.move).toBe(2); expect(b.spread).toBeNull();
 });
 it('rejects asynchronous and future quote comparisons', () => {
  expect(buildBrief([quote('QQQ',2,'2026-11-25T15:41:00Z'),quote('GLD',.5)],null,now).spread).toBeNull();
  expect(buildBrief([quote('QQQ',2,'2026-11-26T15:59:00Z'),quote('GLD',.5)],null,now).spread).toBeNull();
 });
 it('normalizes Treasury yield and rejects invalid prices', () => {
  const b=buildBrief([{...quote('^TNX',1),price:42.8},{...quote('SPY',1),price:NaN}],null,now);
  expect(b.signals['^TNX'].value).toBe(4.28); expect(b.signals.SPY.usable).toBe(false);
 });
});
