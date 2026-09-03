-- Five-call IQBulls picks: STOCK_1/2/3, BTC_GOLD, INTERNATIONAL.
--
-- Migration behavior for existing community_picks rows (010/013):
-- - call_slot defaults to STOCK_1
-- - ticker / entry_price / picked_at / banked_growth_factor preserved exactly
-- - No fabricated history for empty slots
-- - community_pick_history rows default to STOCK_1 (legacy closed legs)

alter table community_picks
  add column if not exists call_slot text not null default 'STOCK_1';

alter table community_picks
  drop constraint if exists community_picks_call_slot_check;

alter table community_picks
  add constraint community_picks_call_slot_check
  check (call_slot in ('STOCK_1', 'STOCK_2', 'STOCK_3', 'BTC_GOLD', 'INTERNATIONAL'));

-- Widen primary key to one active leg per slot.
alter table community_picks drop constraint if exists community_picks_user_group_pkey;
alter table community_picks drop constraint if exists community_picks_pkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_picks_user_group_slot_pkey'
  ) then
    alter table community_picks
      add constraint community_picks_user_group_slot_pkey
      primary key (user_id, group_id, call_slot);
  end if;
end $$;

alter table community_pick_history
  add column if not exists call_slot text not null default 'STOCK_1';

alter table community_pick_history
  drop constraint if exists community_pick_history_call_slot_check;

alter table community_pick_history
  add constraint community_pick_history_call_slot_check
  check (call_slot in ('STOCK_1', 'STOCK_2', 'STOCK_3', 'BTC_GOLD', 'INTERNATIONAL'));

create index if not exists community_picks_group_slot_idx
  on community_picks (group_id, call_slot);

create index if not exists community_pick_history_slot_idx
  on community_pick_history (user_id, group_id, call_slot, closed_at desc);
