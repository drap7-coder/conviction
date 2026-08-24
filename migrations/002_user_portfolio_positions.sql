create table if not exists portfolio_positions (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  ticker text not null,
  shares double precision not null check (shares > 0),
  average_cost double precision check (average_cost > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create index if not exists portfolio_positions_user_id_idx on portfolio_positions(user_id);
