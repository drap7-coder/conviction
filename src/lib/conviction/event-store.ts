import { query, isDatabaseConfigured } from "@/lib/db";

export type ConvictionEventType =
  | "conviction_upgrade"
  | "conviction_downgrade"
  | "signal_expired"
  | "institutional_buying";

export type ConvictionEventSeverity = "high" | "medium" | "low";

export interface ConvictionEventRow {
  id: string;
  event_key: string;
  ticker: string;
  company_name: string;
  event_type: ConvictionEventType;
  severity: ConvictionEventSeverity;
  headline: string;
  description: string;
  source_url: string | null;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ConvictionEventWithState extends ConvictionEventRow {
  is_read: boolean;
  is_dismissed: boolean;
  read_at: string | null;
}

/**
 * Build a deterministic event_key for idempotent insert.
 * event_key = `${ticker}:${type}:${sourceId}`
 */
export function buildEventKey(
  ticker: string,
  type: string,
  sourceId: string,
): string {
  return `${ticker.toUpperCase()}:${type}:${sourceId}`;
}

/**
 * Insert a conviction event if it does not already exist (idempotent).
 * Returns the event id on success, or null if it already existed.
 */
export async function insertConvictionEvent(event: {
  event_key: string;
  ticker: string;
  company_name: string;
  event_type: ConvictionEventType;
  severity: ConvictionEventSeverity;
  headline: string;
  description?: string;
  source_url?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;

  const result = await query<{ id: string }>(
    `insert into conviction_events (event_key, ticker, company_name, event_type, severity, headline, description, source_url, source, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (event_key) do nothing
     returning id`,
    [
      event.event_key,
      event.ticker.toUpperCase(),
      event.company_name,
      event.event_type,
      event.severity,
      event.headline,
      event.description ?? "",
      event.source_url ?? null,
      event.source ?? "sec-edgar",
      JSON.stringify(event.metadata ?? {}),
    ],
  );

  return result.rows[0]?.id ?? null;
}

/**
 * Fetch the activity feed for a user, joining global events with user state.
 * Sorted: unread first, then by severity, then by recency.
 */
export async function getUserActivityFeed(
  userId: string,
  limit = 50,
  offset = 0,
): Promise<ConvictionEventWithState[]> {
  if (!isDatabaseConfigured()) return [];

  const result = await query<ConvictionEventWithState>(
    `select
       e.id,
       e.event_key,
       e.ticker,
       e.company_name,
       e.event_type,
       e.severity,
       e.headline,
       e.description,
       e.source_url,
       e.source,
       e.metadata,
       e.created_at,
       coalesce(ues.is_read, false) as is_read,
       coalesce(ues.is_dismissed, false) as is_dismissed,
       ues.read_at
     from conviction_events e
     left join user_conviction_event_state ues
       on ues.event_id = e.id and ues.user_id = $1
     where e.ticker = any(
       select ticker from watchlist_entries where user_id = $1 and status = 'active'
     )
     and (ues.is_dismissed is null or ues.is_dismissed = false)
     order by
       (ues.is_read is null or ues.is_read = false) desc,
       case e.severity when 'high' then 0 when 'medium' then 1 when 'low' then 2 end asc,
       e.created_at desc
     limit $2 offset $3`,
    [userId, limit, offset],
  );

  return result.rows.map((row) => ({
    ...row,
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata as string) : row.metadata,
  })) as unknown as ConvictionEventWithState[];
}

/**
 * Get the count of unread events for a user (for the badge).
 */
export async function getUnreadEventCount(userId: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  const result = await query<{ count: string }>(
    `select count(*) as count
     from conviction_events e
     left join user_conviction_event_state ues
       on ues.event_id = e.id and ues.user_id = $1
     where e.ticker = any(
       select ticker from watchlist_entries where user_id = $1 and status = 'active'
     )
     and (ues.is_read is null or ues.is_read = false)
     and (ues.is_dismissed is null or ues.is_dismissed = false)`,
    [userId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Mark a single event as read for a user.
 */
export async function markEventAsRead(
  userId: string,
  eventId: string,
): Promise<void> {
  if (!isDatabaseConfigured()) return;

  await query(
    `insert into user_conviction_event_state (user_id, event_id, is_read, read_at)
     values ($1, $2, true, now())
     on conflict (user_id, event_id)
     do update set is_read = true, read_at = now()`,
    [userId, eventId],
  );
}

/**
 * Mark all events for a user's watchlist as read.
 */
export async function markAllEventsAsRead(userId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;

  await query(
    `insert into user_conviction_event_state (user_id, event_id, is_read, read_at)
     select $1, e.id, true, now()
     from conviction_events e
     where e.ticker = any (
       select ticker from watchlist_entries where user_id = $1 and status = 'active'
     )
     on conflict (user_id, event_id)
     do update set is_read = true, read_at = now()`,
    [userId],
  );
}

/**
 * Dismiss a single event for a user.
 */
export async function dismissEvent(
  userId: string,
  eventId: string,
): Promise<void> {
  if (!isDatabaseConfigured()) return;

  await query(
    `insert into user_conviction_event_state (user_id, event_id, is_dismissed)
     values ($1, $2, true)
     on conflict (user_id, event_id)
     do update set is_dismissed = true`,
    [userId, eventId],
  );
}