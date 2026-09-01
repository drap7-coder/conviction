-- Weekly pick snapshot engine — extends dormant 004 competitions schema.

alter table competitions
  add column if not exists status text not null default 'open';

alter table competitions drop constraint if exists competitions_status_check;
alter table competitions add constraint competitions_status_check
  check (status in ('open', 'live', 'final', 'archived'));

alter table competitions
  add column if not exists locked_at timestamptz,
  add column if not exists winner_group_id text references groups(id) on delete set null;

alter table competition_picks
  add column if not exists start_price numeric(12, 4),
  add column if not exists current_price numeric(12, 4),
  add column if not exists final_price numeric(12, 4),
  add column if not exists return_pct numeric(8, 4),
  add column if not exists locked_at timestamptz;

-- One active pick per user per competition (group captured at submit time).
alter table competition_picks
  drop constraint if exists competition_picks_competition_id_user_id_group_id_key;

drop index if exists competition_picks_competition_id_user_id_group_id_key;

create unique index if not exists competition_picks_one_per_user_idx
  on competition_picks (competition_id, user_id);

create index if not exists competition_picks_locked_idx
  on competition_picks (competition_id)
  where locked_at is not null;
