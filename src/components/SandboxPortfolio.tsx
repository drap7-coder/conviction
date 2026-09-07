"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { fetchMarketQuotes } from "@/lib/market/client-market-data";
import type { StockQuote } from "@/lib/market/quotes";
import { getLivePrice } from "@/lib/market/live-quote";
import { sanitizeWatchlistSymbol } from "@/lib/watchlist/sanitize-ticker";
import { SAMPLE_PORTFOLIO_BOOKS, sampleBookSleeves } from "@/lib/portfolio/sample-books";
import { PortfolioBenchmarkChart } from "@/components/PortfolioBenchmarkChart";
import {
  analyzeSandbox,
  equalizeSandboxHoldings,
  normalizeSandboxHoldings,
  SANDBOX_MAX_HOLDINGS,
  SANDBOX_STARTING_VALUE,
  SANDBOX_STORAGE_KEY,
  type SandboxHolding,
} from "@/lib/portfolio/sandbox";

const QUICK_ASSETS = ["AAPL", "MSFT", "NVDA", "GLD", "BTC-USD", "USO"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function SandboxPortfolio() {
  const [holdings, setHoldings] = useState<SandboxHolding[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [tickerInput, setTickerInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SANDBOX_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { holdings?: SandboxHolding[] };
        if (Array.isArray(parsed.holdings)) setHoldings(parsed.holdings.slice(0, SANDBOX_MAX_HOLDINGS));
      }
    } catch { /* A damaged local draft should never block the page. */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify({ holdings }));
  }, [holdings, hydrated]);

  useEffect(() => {
    if (!holdings.length) { setQuotes([]); return; }
    const controller = new AbortController();
    fetchMarketQuotes(holdings.map((holding) => holding.ticker), { signal: controller.signal })
      .then((nextQuotes) => {
        setQuotes(nextQuotes);
        setHoldings((current) => current.map((holding) => {
          if (holding.entryPrice) return holding;
          const quote = nextQuotes.find((item) => item.ticker.toUpperCase() === holding.ticker);
          const price = quote ? getLivePrice(quote)?.price ?? quote.price : null;
          return price && price > 0 ? { ...holding, entryPrice: price } : holding;
        }));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [holdings.map((holding) => holding.ticker).join(",")]);

  const analysis = useMemo(() => analyzeSandbox(holdings), [holdings]);
  const quoteByTicker = useMemo(() => new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote])), [quotes]);
  const currentValue = holdings.reduce((sum, holding) => {
    const quote = quoteByTicker.get(holding.ticker);
    const current = quote ? getLivePrice(quote)?.price ?? quote.price : null;
    const initial = SANDBOX_STARTING_VALUE * holding.weight / 100;
    return sum + (current && holding.entryPrice ? initial * current / holding.entryPrice : initial);
  }, SANDBOX_STARTING_VALUE * analysis.cashPct / 100);
  const dayPct = holdings.reduce((sum, holding) => sum + (quoteByTicker.get(holding.ticker)?.changePercent ?? 0) * holding.weight / 100, 0);
  const chartPositions = holdings.flatMap((holding) => {
    const quote = quoteByTicker.get(holding.ticker);
    const price = quote ? getLivePrice(quote)?.price ?? quote.price : null;
    return price && price > 0 ? [{ ticker: holding.ticker, shares: SANDBOX_STARTING_VALUE * holding.weight / 100 / price }] : [];
  });

  function addTicker(raw: string) {
    const ticker = sanitizeWatchlistSymbol(raw);
    if (!ticker) { setError("Enter a ticker such as AAPL, GLD, USO, or BTC-USD."); return; }
    if (holdings.some((holding) => holding.ticker === ticker)) { setError(`${ticker} is already here.`); return; }
    if (holdings.length >= SANDBOX_MAX_HOLDINGS) { setError("Sandbox holds up to 10 assets."); return; }
    setHoldings((current) => equalizeSandboxHoldings([...current, { ticker, weight: 0 }]));
    setTickerInput(""); setError(null);
  }

  function updateWeight(ticker: string, requested: number) {
    setHoldings((current) => {
      const otherTotal = current.reduce((sum, holding) => sum + (holding.ticker === ticker ? 0 : holding.weight), 0);
      const weight = Math.max(0, Math.min(100 - otherTotal, Number.isFinite(requested) ? requested : 0));
      return current.map((holding) => holding.ticker === ticker ? { ...holding, weight: Number(weight.toFixed(1)) } : holding);
    });
  }

  async function askIq(prompt = question) {
    if (!prompt.trim() || asking) return;
    setQuestion(prompt); setAsking(true); setAnswer(null);
    try {
      const response = await fetch("/api/sandbox/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: prompt, holdings, analysis, currentValue, dayPct }) });
      const data = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Ask IQ is unavailable.");
      setAnswer(data.answer ?? null);
    } catch (caught) { setAnswer(caught instanceof Error ? caught.message : "Ask IQ is unavailable."); }
    finally { setAsking(false); }
  }

  return <div className="pf-sandbox">
    <section className="pf-sandbox-hero surface-shell">
      <div><span className="pf-section-eyebrow">Personal sandbox</span><h1>{money.format(currentValue)}</h1><p>Start with a fictional $100K. Try ideas without touching your real portfolio.</p></div>
      <div className="pf-sandbox-hero-stats"><div><span>Today</span><strong className={dayPct < -0.005 ? "is-negative" : dayPct > 0.005 ? "is-positive" : ""}>{Math.abs(dayPct) < 0.005 ? "0.00" : `${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(2)}`}%</strong></div><div><span>Cash</span><strong>{analysis.cashPct}%</strong></div></div>
    </section>

    <section className="pf-sandbox-builder surface-shell">
      <header><div><span className="pf-section-eyebrow">Build the mix</span><h2>{holdings.length}/10 assets</h2></div><div className="pf-sandbox-actions"><button type="button" onClick={() => setHoldings(equalizeSandboxHoldings(holdings))} disabled={!holdings.length}>Equalize</button><button type="button" onClick={() => setHoldings(normalizeSandboxHoldings(holdings))} disabled={!holdings.length}>Normalize</button><button type="button" onClick={() => setHoldings([])} disabled={!holdings.length}>Reset</button></div></header>
      <form className="pf-sandbox-add" onSubmit={(event: FormEvent) => { event.preventDefault(); addTicker(tickerInput); }}><input value={tickerInput} onChange={(event) => setTickerInput(event.target.value.toUpperCase())} placeholder="Add a ticker" aria-label="Ticker" /><button type="submit">Add asset</button></form>
      {error ? <p className="pf-sandbox-error" role="alert">{error}</p> : null}
      <div className="pf-sandbox-quick" aria-label="Quick add assets">{QUICK_ASSETS.map((ticker) => <button type="button" key={ticker} disabled={holdings.some((holding) => holding.ticker === ticker)} onClick={() => addTicker(ticker)}>+ {ticker}</button>)}</div>
      <div className="pf-sandbox-templates"><span>Or borrow a proven shape</span><div>{SAMPLE_PORTFOLIO_BOOKS.slice(0, 4).map((book) => <button type="button" key={book.id} onClick={() => setHoldings(sampleBookSleeves(book).map((sleeve) => ({ ...sleeve })))}>{book.emoji} {book.label}</button>)}</div></div>
      {holdings.length ? <div className="pf-sandbox-holdings">{holdings.map((holding) => {
        const quote = quoteByTicker.get(holding.ticker); const current = quote ? getLivePrice(quote)?.price ?? quote.price : null;
        return <div className="pf-sandbox-row" key={holding.ticker}><div className="pf-sandbox-row-name"><strong>{holding.ticker}</strong><span>{quote?.name ?? "Waiting for quote"}</span></div><input type="range" min="0" max="100" step="1" value={holding.weight} aria-label={`${holding.ticker} allocation`} onChange={(event) => updateWeight(holding.ticker, Number(event.target.value))}/><label><input type="number" min="0" max="100" step="1" value={holding.weight} onChange={(event) => updateWeight(holding.ticker, Number(event.target.value))}/><span>%</span></label><span className="pf-sandbox-row-value">{money.format(SANDBOX_STARTING_VALUE * holding.weight / 100)}{current ? ` · $${current.toFixed(2)}` : ""}</span><button type="button" className="pf-sandbox-remove" aria-label={`Remove ${holding.ticker}`} onClick={() => setHoldings((currentHoldings) => currentHoldings.filter((item) => item.ticker !== holding.ticker))}>×</button></div>;
      })}</div> : <div className="pf-sandbox-empty">Add a first stock—or load a template and change one piece at a time.</div>}
    </section>

    <section className="pf-sandbox-diagnostics" aria-label="Portfolio diagnostics">
      <div className="surface-shell"><span>Construction risk</span><strong>{analysis.riskScore}<small>/100</small></strong><em>{analysis.riskLabel}</em></div>
      <div className="surface-shell"><span>Diversification</span><strong>{analysis.diversificationScore}<small>/100</small></strong><em>{analysis.effectiveHoldings} effective holdings</em></div>
      <div className="surface-shell"><span>Largest position</span><strong>{analysis.largestPct}<small>%</small></strong><em>{holdings.length ? "Watch above 25%" : "No positions yet"}</em></div>
    </section>
    {holdings.length ? <section className="pf-sandbox-readout surface-shell"><span className="pf-section-eyebrow">What the gauges say</span><ul>{analysis.observations.map((observation) => <li key={observation}>{observation}</li>)}</ul></section> : null}
    {chartPositions.length ? <PortfolioBenchmarkChart positions={chartPositions} benchmarkTicker="SPY" benchmarkLabel="S&P 500" /> : null}

    <section className="pf-sandbox-copilot surface-shell">
      <header><div><span className="pf-section-eyebrow">Ask IQ</span><h2>Your portfolio copilot</h2></div><span className="pf-sandbox-ai-dot">AI</span></header>
      <p>Ask in plain English. IQ uses the sandbox numbers above—it does not place trades.</p>
      <div className="pf-sandbox-prompts">{["What is my biggest risk?", "How could I make this steadier?", "Explain this portfolio to a beginner."].map((prompt) => <button type="button" key={prompt} onClick={() => askIq(prompt)}>{prompt}</button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); void askIq(); }}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={800} placeholder="Ask about concentration, trade-offs, or a what-if…"/><button type="submit" disabled={!question.trim() || asking}>{asking ? "Thinking…" : "Ask IQ"}</button></form>
      {answer ? <div className="pf-sandbox-answer" aria-live="polite">{answer}</div> : null}
      <small>Educational sandbox only. Results are estimates, not investment advice.</small>
    </section>
  </div>;
}
