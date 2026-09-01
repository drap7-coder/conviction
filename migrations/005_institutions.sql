-- Platform → Institution → Groups → Members → Portfolios/Competitions
-- Institutions are canonical (seeded/admin). Users create groups under an institution.
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

-- Groups are no longer peer schools/orgs — type collapses to 'group'.
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

-- Canonical first institution (William & Mary). Unofficial — not affiliated.
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

-- Remap legacy flat "William & Mary" school container → Campus group under the institution.
update groups
set institution_id = 'institution-wm',
    type = 'group',
    name = case when name = 'William & Mary' then 'Campus' else name end,
    invite_code = coalesce(invite_code, 'wm-campus')
where name in ('William & Mary', 'Campus')
   or id = 'group-seed-wm';
