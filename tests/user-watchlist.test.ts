import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WatchlistEntry } from "@/lib/watchlist/types";
import * as repo from "@/lib/user-watchlist";

interface Row {
  id: string;
  user_id: string;
  ticker: string;
  note: string;
  company_name: string;
  cik: string | null;
  status: WatchlistEntry["status"];
  status_message: string | null;
  created_at: Date;
}

let rows: Row[] = [];
let nextId = 1;

vi.mock("@/lib/db", () => ({
  isDatabaseConfigured: () => true,
  query: vi.fn(async (text: string, values: unknown[]) => {
    const compact = text.replace(/\s+/g, " ").trim().toLowerCase();

    if (compact.startsWith("select")) {
      const userId = values[0] as string;
      return {
        rowCount: rows.filter((row) => row.user_id === userId).length,
        rows: rows.filter((row) => row.user_id === userId),
      };
    }

    if (compact.startsWith("insert")) {
      const [userId, ticker, companyName, cik, status, statusMessage] = values as [
        string,
        string,
        string,
        string | null,
        WatchlistEntry["status"],
        string | null,
      ];
      const existing = rows.find((row) => row.user_id === userId && row.ticker === ticker);
      if (existing) return { rowCount: 0, rows: [] };

      const row: Row = {
        id: `row-${nextId++}`,
        user_id: userId,
        ticker,
        note: "",
        company_name: companyName,
        cik,
        status,
        status_message: statusMessage,
        created_at: new Date("2026-07-15T00:00:00.000Z"),
      };
      rows.push(row);
      return { rowCount: 1, rows: [row] };
    }

    if (compact.startsWith("update")) {
      const [userId, ticker, note] = values as [string, string, string];
      const row = rows.find((item) => item.user_id === userId && item.ticker === ticker);
      if (!row) return { rowCount: 0, rows: [] };
      row.note = note;
      return { rowCount: 1, rows: [] };
    }

    if (compact.startsWith("delete")) {
      const [userId, ticker] = values as [string, string];
      const before = rows.length;
      rows = rows.filter((row) => !(row.user_id === userId && row.ticker === ticker));
      return { rowCount: before - rows.length, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }),
}));

const entry: WatchlistEntry = {
  ticker: "APLD",
  companyName: "Applied Digital Corporation",
  cik: "0001144879",
  addedAt: new Date("2026-07-15T00:00:00.000Z").toISOString(),
  status: "active",
};

describe("user watchlist privacy", () => {
  beforeEach(() => {
    rows = [];
    nextId = 1;
  });

  it("lets one user add and view a ticker without exposing it to another user", async () => {
    const added = await repo.addUserWatchlistEntry("user-a", entry);

    expect(added.success).toBe(true);
    expect(await repo.getUserWatchlist("user-a")).toHaveLength(1);
    expect(await repo.getUserWatchlist("user-b")).toHaveLength(0);
  });

  it("allows the same ticker for multiple users", async () => {
    expect((await repo.addUserWatchlistEntry("user-a", entry)).success).toBe(true);
    expect((await repo.addUserWatchlistEntry("user-b", entry)).success).toBe(true);

    expect(await repo.getUserWatchlist("user-a")).toHaveLength(1);
    expect(await repo.getUserWatchlist("user-b")).toHaveLength(1);
  });

  it("does not duplicate the same ticker for one user", async () => {
    expect((await repo.addUserWatchlistEntry("user-a", entry)).success).toBe(true);
    const duplicate = await repo.addUserWatchlistEntry("user-a", entry);

    expect(duplicate.success).toBe(false);
    expect(await repo.getUserWatchlist("user-a")).toHaveLength(1);
  });

  it("prevents one user from editing or deleting another user's ticker", async () => {
    await repo.addUserWatchlistEntry("user-a", entry);

    expect((await repo.updateUserWatchlistNote("user-b", "APLD", "Not yours")).success).toBe(false);
    expect((await repo.removeUserWatchlistEntry("user-b", "APLD")).success).toBe(false);

    const userAEntries = await repo.getUserWatchlist("user-a");
    expect(userAEntries).toHaveLength(1);
    expect(userAEntries[0].note).toBe("");
  });
});
