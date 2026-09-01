-- Multi-group membership, competitions, and weekly picks (v1).
-- Users may belong to many groups; schools and orgs are peers (no parent/child).

create extension if not exists pgcrypto;

create table if not exists groups (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  type text not null check (type in ('school', 'org')),
  primary_color text,
  created_at timestamptz not null default now(),
  unique (name)
);

create index if not exists groups_type_idx on groups(type);

create table if not exists user_group_memberships (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  group_id text not null references groups(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, group_id)
);

create index if not exists user_group_memberships_user_idx on user_group_memberships(user_id);
create index if not exists user_group_memberships_group_idx on user_group_memberships(group_id);

-- At most one primary membership per user (partial unique index).
create unique index if not exists user_group_memberships_one_primary_idx
  on user_group_memberships(user_id)
  where is_primary;

create table if not exists competitions (
  id text primary key default gen_random_uuid()::text,
  group_a_id text not null references groups(id) on delete cascade,
  group_b_id text not null references groups(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  metric text not null default 'avg_pct_return'
    check (metric = 'avg_pct_return'),
  created_at timestamptz not null default now(),
  check (group_a_id <> group_b_id),
  check (period_end > period_start)
);

create index if not exists competitions_period_idx on competitions(period_start, period_end);

-- Picks are bound to (user, group, competition) at submit time so mid-week
-- membership changes do not rewrite active rosters.
create table if not exists competition_picks (
  id text primary key default gen_random_uuid()::text,
  competition_id text not null references competitions(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  group_id text not null references groups(id) on delete cascade,
  ticker text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, user_id, group_id)
);

create index if not exists competition_picks_competition_idx on competition_picks(competition_id);
create index if not exists competition_picks_group_idx on competition_picks(group_id);
