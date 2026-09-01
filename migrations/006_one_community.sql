-- Post-deploy consolidation for the one-community product.
-- Run after the one-community code is live so production never sits between schemas.
-- Does NOT drop competitions / subgroup tables — keeps them dormant.

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

insert into groups (id, institution_id, name, type, primary_color, invite_code)
values ('group-wm', 'institution-wm', 'William & Mary', 'group', '#115740', 'wm')
on conflict (id) do update set
  institution_id = excluded.institution_id,
  name = excluded.name,
  invite_code = coalesce(groups.invite_code, excluded.invite_code);

-- Clear invite codes on dormant W&M subgroup rows; keep wm on the canonical community.
update groups
set invite_code = null
where institution_id = 'institution-wm'
  and id <> 'group-wm'
  and invite_code is not null;

update groups
set invite_code = 'wm'
where id = 'group-wm';

-- Copy distinct users from dormant W&M subgroup memberships onto group-wm.
insert into user_group_memberships (user_id, group_id, is_primary)
select m.user_id, 'group-wm', false
from user_group_memberships m
join groups g on g.id = m.group_id
where g.institution_id = 'institution-wm'
  and m.group_id <> 'group-wm'
on conflict (user_id, group_id) do nothing;

-- Preserve primary if any dormant row was primary.
update user_group_memberships ug
set is_primary = true
where ug.group_id = 'group-wm'
  and exists (
    select 1
    from user_group_memberships m
    join groups g on g.id = m.group_id
    where m.user_id = ug.user_id
      and g.institution_id = 'institution-wm'
      and m.group_id <> 'group-wm'
      and m.is_primary
  );

delete from user_group_memberships m
using groups g
where m.group_id = g.id
  and g.institution_id = 'institution-wm'
  and m.group_id <> 'group-wm';

insert into user_institution_memberships (user_id, institution_id)
select distinct m.user_id, 'institution-wm'
from user_group_memberships m
where m.group_id = 'group-wm'
on conflict (user_id, institution_id) do nothing;
