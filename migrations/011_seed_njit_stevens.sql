-- Seed NJIT and Stevens as canonical school communities for the njit-stevens rivalry pair.

insert into institutions (
  id, name, slug, type, canonical_domain, affiliation_status, accent_color
) values
  (
    'institution-njit',
    'New Jersey Institute of Technology',
    'njit',
    'university',
    'njit.edu',
    'unofficial',
    '#CC0000'
  ),
  (
    'institution-stevens',
    'Stevens Institute of Technology',
    'stevens',
    'university',
    'stevens.edu',
    'unofficial',
    '#A32638'
  )
on conflict (slug) do update set
  name = excluded.name,
  canonical_domain = excluded.canonical_domain,
  affiliation_status = excluded.affiliation_status,
  accent_color = excluded.accent_color;

insert into groups (id, institution_id, name, type, primary_color, invite_code)
values
  (
    'group-njit',
    'institution-njit',
    'New Jersey Institute of Technology',
    'group',
    '#CC0000',
    'njit'
  ),
  (
    'group-stevens',
    'institution-stevens',
    'Stevens Institute of Technology',
    'group',
    '#A32638',
    'stevens'
  )
on conflict (id) do update set
  institution_id = excluded.institution_id,
  name = excluded.name,
  primary_color = excluded.primary_color,
  invite_code = coalesce(groups.invite_code, excluded.invite_code);
