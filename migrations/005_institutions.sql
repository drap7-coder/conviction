-- Platform → Community (Institution) → Members → Portfolios
-- Institutions are the public community. One canonical groups row per institution
-- is kept for membership / Crowd scoping. Subgroup / competition tables from 004
-- remain for future compatibility but are not product-facing.
-- Do not store official logos or protected branding — accent_color is optional UI only.

create extension if not exists pgcrypto;

create table if not exists institutions (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  slug text not null,
  type text not null
    check (type in ('university', 'company', 'high_school', 'organization')),
  canonical_domain text,
  affiliation_status text not null default 'unofficial'
    check (affiliation_status in ('unofficial', 'official')),
  accent_color text,
  created_at timestamptz not null default now(),
  unique (slug),
  unique (canonical_domain)
);

create index if not exists institutions_type_idx on institutions(type);

create table if not exists user_institution_memberships (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  institution_id text not null references institutions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, institution_id)
);

create index if not exists user_institution_memberships_user_idx
  on user_institution_memberships(user_id);
create index if not exists user_institution_memberships_institution_idx
  on user_institution_memberships(institution_id);

-- Attach groups to an institution; invite_code powers share links.
alter table groups add column if not exists institution_id text references institutions(id) on delete cascade;
alter table groups add column if not exists invite_code text;
alter table groups add column if not exists created_by text references users(id) on delete set null;

-- Groups type collapses to 'group' (compatibility row under an institution).
alter table groups drop constraint if exists groups_type_check;
update groups set type = 'group' where type is distinct from 'group';
alter table groups alter column type set default 'group';
alter table groups add constraint groups_type_check check (type = 'group');

-- Name uniqueness is per institution (not global).
alter table groups drop constraint if exists groups_name_key;
create unique index if not exists groups_institution_name_uidx
  on groups (institution_id, name)
  where institution_id is not null;
create unique index if not exists groups_invite_code_uidx
  on groups (invite_code)
  where invite_code is not null;
create index if not exists groups_institution_idx on groups(institution_id);

-- Canonical first community (William & Mary). Unofficial — not affiliated.
insert into institutions (
  id, name, slug, type, canonical_domain, affiliation_status, accent_color
) values (
  'institution-wm',
  'William & Mary',
  'wm',
  'university',
  'wm.edu',
  'unofficial',
  '#115740'
) on conflict (slug) do nothing;

-- One public community row for W&M (id group-wm). Legacy flat school container remaps here.
insert into groups (id, institution_id, name, type, primary_color, invite_code)
values ('group-wm', 'institution-wm', 'William & Mary', 'group', '#115740', 'wm')
on conflict (id) do update set
  institution_id = excluded.institution_id,
  name = excluded.name,
  primary_color = excluded.primary_color,
  invite_code = coalesce(groups.invite_code, excluded.invite_code);

update groups
set institution_id = 'institution-wm',
    type = 'group',
    name = 'William & Mary',
    invite_code = coalesce(nullif(invite_code, ''), 'wm')
where id in ('group-seed-wm', 'group-wm')
   or (name = 'William & Mary' and (institution_id is null or institution_id = 'institution-wm'))
   or name = 'Campus';
