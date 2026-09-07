create table if not exists sandbox_portfolios (
  user_id text primary key references users(id) on delete cascade,
  holdings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sandbox_portfolios_updated_at_idx on sandbox_portfolios(updated_at desc);
