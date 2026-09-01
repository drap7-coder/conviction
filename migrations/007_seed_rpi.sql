-- Seed Rensselaer (RPI) as the second canonical school community.
-- Same pattern as W&M: one institution + one group row. Not user-created.

insert into institutions (
  id, name, slug, type, canonical_domain, affiliation_status, accent_color
) values (
  'institution-rpi',
  'Rensselaer Polytechnic Institute',
  'rpi',
  'university',
  'rpi.edu',
  'unofficial',
  '#D6001C'
) on conflict (slug) do update set
  name = excluded.name,
  canonical_domain = excluded.canonical_domain,
  affiliation_status = excluded.affiliation_status,
  accent_color = excluded.accent_color;

insert into groups (id, institution_id, name, type, primary_color, invite_code)
values (
  'group-rpi',
  'institution-rpi',
  'Rensselaer Polytechnic Institute',
  'group',
  '#D6001C',
  'rpi'
)
on conflict (id) do update set
  institution_id = excluded.institution_id,
  name = excluded.name,
  primary_color = excluded.primary_color,
  invite_code = coalesce(groups.invite_code, excluded.invite_code);
