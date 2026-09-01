-- Decouple canonical directory presence from active community status.
-- Bulk NCAA rows are seeded at runtime via ensureNcaaInstitutionDirectory().

alter table institutions
  alter column community_enabled set default false;

-- Preserve live communities and any campus that already has members.
update institutions i
set community_enabled = true
where i.id in ('institution-wm', 'institution-rpi')
   or i.ncaa_id in ('william-mary', 'rensselaer')
   or exists (
     select 1
     from groups g
     join user_group_memberships m on m.group_id = g.id
     where g.institution_id = i.id
   );

-- Backfill ncaa_id on legacy rows when missing.
update institutions
set ncaa_id = 'william-mary', community_enabled = true
where id = 'institution-wm' and ncaa_id is null;

update institutions
set ncaa_id = 'rensselaer', community_enabled = true
where id = 'institution-rpi' and ncaa_id is null;
