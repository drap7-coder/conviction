import { kv } from "@vercel/kv";
import fs from "node:fs";
import path from "node:path";
import type { ConvictionSnapshot, ConvictionTransition } from "./snapshot";

const KV_ENABLED = Boolean(process.env.KV_URL && process.env.KV_REST_API_URL);
const SNAPSHOTS_KEY = "conviction:snapshots";
const TRANSITIONS_KEY = "conviction:transitions";
const LOCAL_STORE_DIR = path.join(process.cwd(), ".conviction");
const LOCAL_STORE_FILE = path.join(LOCAL_STORE_DIR, "conviction-transitions.json");
const MAX_TRANSITIONS = 100;

interface ConvictionTransitionStore {
  snapshots: Record<string, ConvictionSnapshot>;
  transitions: ConvictionTransition[];
}

function defaultStore(): ConvictionTransitionStore {
  return {
    snapshots: {},
    transitions: [],
  };
}

function readLocalStore(): ConvictionTransitionStore {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_STORE_FILE, "utf-8")) as ConvictionTransitionStore;
    }
  } catch {
    // Local persistence is best-effort.
  }
  return defaultStore();
}

function writeLocalStore(store: ConvictionTransitionStore) {
  try {
    if (!fs.existsSync(LOCAL_STORE_DIR)) fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (error) {
    console.warn("[conviction-transition-store] Failed to write local store:", error);
  }
}

async function readStore(): Promise<ConvictionTransitionStore> {
  if (KV_ENABLED) {
    try {
      const [snapshots, transitions] = await Promise.all([
        kv.get<Record<string, ConvictionSnapshot>>(SNAPSHOTS_KEY),
        kv.get<ConvictionTransition[]>(TRANSITIONS_KEY),
      ]);
      return {
        snapshots: snapshots ?? {},
        transitions: transitions ?? [],
      };
    } catch (error) {
      console.warn("[conviction-transition-store] KV read failed:", error);
    }
  }
  return readLocalStore();
}

async function writeStore(store: ConvictionTransitionStore) {
  store.transitions = store.transitions
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_TRANSITIONS);

  if (KV_ENABLED) {
    try {
      await Promise.all([
        kv.set(SNAPSHOTS_KEY, store.snapshots),
        kv.set(TRANSITIONS_KEY, store.transitions),
      ]);
      return;
    } catch (error) {
      console.warn("[conviction-transition-store] KV write failed:", error);
    }
  }
  writeLocalStore(store);
}

export async function getConvictionSnapshot(ticker: string): Promise<ConvictionSnapshot | null> {
  const store = await readStore();
  return store.snapshots[ticker.toUpperCase()] ?? null;
}

export async function saveConvictionSnapshot(snapshot: ConvictionSnapshot): Promise<void> {
  const store = await readStore();
  store.snapshots[snapshot.ticker] = snapshot;
  await writeStore(store);
}

export async function recordConvictionTransition(transition: ConvictionTransition): Promise<void> {
  const store = await readStore();
  if (!store.transitions.some((entry) => entry.id === transition.id)) {
    store.transitions.unshift(transition);
  }
  await writeStore(store);
}

export async function getRecentConvictionTransitions(limit = 6): Promise<ConvictionTransition[]> {
  const store = await readStore();
  return store.transitions
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function clearConvictionTransitionStore(): Promise<void> {
  await writeStore(defaultStore());
}
