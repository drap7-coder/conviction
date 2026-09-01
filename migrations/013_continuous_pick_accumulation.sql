-- Continuous accumulation: banked growth factor + append-only pick history.
--
-- Migration behavior for existing community_picks rows (010):
-- - banked_growth_factor defaults to 1.0 (no fabricated prior history)
-- - active ticker/start spot/started-at remain as-is (entry_price, picked_at)
-- - No backfill into community_pick_history — prior single-entry picks are not
--   converted into closed legs because reliable exit spots do not exist.

alter table community_picks
  add column if not exists banked_growth_factor numeric(20, 10) not null default 1.0
    check (banked_growth_factor > 0);

-- One active pick state per user per group (was user_id-only PK in 010).
alter table community_picks drop constraint if exists community_picks_pkey;
alter table community_picks
  add constraint community_picks_user_group_pkey primary key (user_id, group_id);

create table if not exists community_pick_history (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  group_id text not null references groups(id) on delete cascade,
  ticker text not null,
  start_spot numeric(14, 4) not null check (start_spot > 0),
  exit_spot numeric(14, 4) not null check (exit_spot > 0),
  pick_growth_factor numeric(20, 10) not null check (pick_growth_factor > 0),
  started_at timestamptz not null,
  closed_at timestamptz not null default now()
);

create index if not exists community_pick_history_user_idx
  on community_pick_history (user_id, closed_at desc);

create index if not exists community_pick_history_group_idx
  on community_pick_history (group_id, closed_at desc);
