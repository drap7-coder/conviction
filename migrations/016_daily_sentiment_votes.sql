create table if not exists daily_sentiment_votes (
  id bigserial primary key,
  poll_date date not null,
  ticker varchar(24) not null,
  vote varchar(8) not null check (vote in ('bullish', 'bearish')),
  voter_hash char(64) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poll_date, ticker, voter_hash)
);

create index if not exists daily_sentiment_votes_ticker_date_idx
  on daily_sentiment_votes (ticker, poll_date);
