-- Continuous community picks: one current ticker per member, no date gates.

create table if not exists community_picks (
  user_id text primary key references users(id) on delete cascade,
  group_id text not null references groups(id) on delete cascade,
  ticker text not null,
  entry_price numeric(14, 4) not null check (entry_price > 0),
  picked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_picks_group_idx
  on community_picks (group_id);
