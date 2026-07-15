create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  name text,
  email text unique,
  "emailVerified" timestamptz,
  image text,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null references users(id) on delete cascade,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  unique (provider, "providerAccountId")
);

create table if not exists sessions (
  id text primary key default gen_random_uuid()::text,
  "sessionToken" text not null unique,
  "userId" text not null references users(id) on delete cascade,
  expires timestamptz not null
);

create table if not exists verification_token (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);

create table if not exists watchlist_entries (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  ticker text not null,
  note text not null default '',
  company_name text not null,
  cik text,
  status text not null check (status in ('active', 'unsupported', 'error')),
  status_message text,
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create index if not exists watchlist_entries_user_id_idx on watchlist_entries(user_id);
