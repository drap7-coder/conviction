import { isDatabaseConfigured, query } from "@/lib/db";
import { SANDBOX_MAX_HOLDINGS, type SandboxHolding } from "@/lib/portfolio/sandbox";

interface SandboxRow {
  [key: string]: unknown;
  holdings: unknown;
  started_at: Date | string;
  updated_at: Date | string;
}

export function normalizeSandboxHoldings(input: unknown): SandboxHolding[] {
  if (!Array.isArray(input)) return [];
  const unique = new Map<string, SandboxHolding>();
  for (const candidate of input.slice(0, SANDBOX_MAX_HOLDINGS)) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    const ticker = typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : "";
    const weight = Number(row.weight);
    const entryPrice = row.entryPrice == null ? null : Number(row.entryPrice);
    if (!/^[A-Z0-9.^-]{1,15}$/.test(ticker)) continue;
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) continue;
    if (entryPrice !== null && (!Number.isFinite(entryPrice) || entryPrice <= 0)) continue;
    unique.set(ticker, { ticker, weight: Number(weight.toFixed(1)), entryPrice });
  }
  const holdings = [...unique.values()];
  const total = holdings.reduce((sum, holding) => sum + holding.weight, 0);
  return total <= 100.1 ? holdings : [];
}

export async function getUserSandbox(userId: string) {
  if (!isDatabaseConfigured()) return null;
  const result = await query<SandboxRow>(
    `select holdings, started_at, updated_at from sandbox_portfolios where user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    holdings: normalizeSandboxHoldings(row.holdings),
    startedAt: new Date(row.started_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function saveUserSandbox(userId: string, input: unknown) {
  if (!isDatabaseConfigured()) throw new Error("Sandbox database storage is unavailable");
  const holdings = normalizeSandboxHoldings(input);
  await query(
    `insert into sandbox_portfolios (user_id, holdings)
     values ($1, $2::jsonb)
     on conflict (user_id) do update
       set holdings = excluded.holdings, updated_at = now()`,
    [userId, JSON.stringify(holdings)],
  );
  return getUserSandbox(userId);
}
