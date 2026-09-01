-- Full NCAA directory support: ncaa_id + community_enabled on institutions.

alter table institutions
  add column if not exists ncaa_id text,
  add column if not exists conference text,
  add column if not exists community_enabled boolean not null default true;

create unique index if not exists institutions_ncaa_id_uidx
  on institutions (ncaa_id)
  where ncaa_id is not null;

update institutions
set ncaa_id = 'william-mary', community_enabled = true
where id = 'institution-wm' and ncaa_id is null;

update institutions
set ncaa_id = 'rensselaer', community_enabled = true
where id = 'institution-rpi' and ncaa_id is null;
