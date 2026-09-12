import { createHash } from "node:crypto";
import { applyMigrations } from "@/lib/db/migrate";
import { isDatabaseConfigured, query } from "@/lib/db";

export type SentimentVote = "bullish" | "bearish";
let schemaReady: Promise<void> | null = null;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function easternPollDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function parseSentimentVote(value: unknown): SentimentVote | null {
  return value === "bullish" || value === "bearish" ? value : null;
}
export function sentimentVoterHash(
  ip: string,
  userAgent: string,
  date: string,
) {
  const secret =
    process.env.SENTIMENT_VOTE_SALT ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  return createHash("sha256")
    .update(`${secret}:${date}:${ip}:${userAgent}`)
    .digest("hex");
}
export function checkSentimentRateLimit(key: string, now = Date.now()) {
  if (buckets.size > 1000)
    for (const [bucketKey, bucket] of buckets)
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 600_000 });
    return true;
  }
  if (current.count >= 20) return false;
  current.count += 1;
  return true;
}
async function ensureSchema() {
  if (!isDatabaseConfigured()) return false;
  if (!schemaReady)
    schemaReady = applyMigrations()
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null;
        throw e;
      });
  await schemaReady;
  return true;
}
export async function sentimentTotals(
  ticker: string,
  date = easternPollDate(),
) {
  if (!(await ensureSchema()))
    return { ticker, date, bullish: 0, bearish: 0, total: 0, available: false };
  const result = await query<{ vote: SentimentVote; count: string }>(
    `select vote,count(*)::text as count from daily_sentiment_votes where ticker=$1 and poll_date=$2 group by vote`,
    [ticker, date],
  );
  let bullish = 0,
    bearish = 0;
  for (const row of result.rows) {
    if (row.vote === "bullish") bullish = Number(row.count);
    else bearish = Number(row.count);
  }
  return {
    ticker,
    date,
    bullish,
    bearish,
    total: bullish + bearish,
    available: true,
  };
}
export async function saveSentimentVote(input: {
  ticker: string;
  date: string;
  vote: SentimentVote;
  voterHash: string;
}) {
  if (!(await ensureSchema()))
    throw new Error("Sentiment voting is unavailable");
  await query(
    `insert into daily_sentiment_votes (poll_date,ticker,vote,voter_hash) values ($1,$2,$3,$4) on conflict (poll_date,ticker,voter_hash) do update set vote=excluded.vote,updated_at=now()`,
    [input.date, input.ticker, input.vote, input.voterHash],
  );
  return sentimentTotals(input.ticker, input.date);
}
