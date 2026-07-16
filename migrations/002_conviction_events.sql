-- Migration 002: Conviction Activity Events
-- Creates append-only global event store and per-user read/dismiss state.

create extension if not exists pgcrypto;

-- Global append-only event store
create table if not exists conviction_events (
  id text primary key default gen_random_uuid()::text,
  event_key text not null unique,              -- deterministic dedup key (idempotent reprocessing)
  ticker text not null,
  company_name text not null,
  event_type text not null,                    -- 'conviction_upgrade', 'conviction_downgrade', 'new_signal', 'signal_expired', 'institutional_buying'
  severity text not null check (severity in ('high', 'medium', 'low')),
  headline text not null,                      -- human-readable one-liner
  description text not null default '',
  source_url text,                             -- link to SEC filing or detail page
  source text not null default 'sec-edgar',
  metadata jsonb not null default '{}',        -- structured data (previous/current status, counts, etc.)
  created_at timestamptz not null default now()
);

create index if not exists conviction_events_created_at_idx on conviction_events(created_at desc);
create index if not exists conviction_events_ticker_idx on conviction_events(ticker);

-- Per-user state for feed interaction
create table if not exists user_conviction_event_state (
  user_id text not null references users(id) on delete cascade,
  event_id text not null references conviction_events(id) on delete cascade,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  read_at timestamptz,
  primary key (user_id, event_id)
);

create index if not exists user_conviction_event_state_user_id_idx on user_conviction_event_state(user_id);