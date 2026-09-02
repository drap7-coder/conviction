import { getPool, isDatabaseConfigured, query } from "@/lib/db";
import {
  CAMPUS_SEED_ID_PREFIX,
  campusSeedEmail,
  listCampusSeedStudents,
} from "@/lib/community-picks/seed-students";
import { ensureSeedGroups } from "@/lib/groups/store";

/**
 * Upsert 5 demo students × each seeded school into memberships + community_picks.
 * Ops: `npm run seed:campus`. Prefer {@link ensureCampusPickSeedsIfNeeded} on read.
 */
export async function ensureCampusPickSeeds(): Promise<{
  seeded: boolean;
  studentCount: number;
  schoolCount: number;
}> {
  const students = listCampusSeedStudents();
  const schoolCount = new Set(students.map((row) => row.groupId)).size;

  if (!isDatabaseConfigured()) {
    return { seeded: false, studentCount: students.length, schoolCount };
  }

  await ensureSeedGroups();

  const client = await getPool().connect();
  try {
    await client.query("begin");

    for (const student of students) {
      await client.query(
        `insert into users (id, name, email)
         values ($1, $2, $3)
         on conflict (id) do update set name = excluded.name`,
        [student.id, student.label, campusSeedEmail(student.id)],
      );

      await client.query(
        `insert into user_institution_memberships (user_id, institution_id)
         values ($1, $2)
         on conflict (user_id, institution_id) do nothing`,
        [student.id, student.institutionId],
      );

      await client.query(
        `insert into user_group_memberships (user_id, group_id, is_primary)
         values ($1, $2, true)
         on conflict (user_id, group_id) do update set is_primary = true`,
        [student.id, student.groupId],
      );

      await client.query(
        `insert into community_picks (
           user_id, group_id, ticker, entry_price, banked_growth_factor, picked_at, updated_at
         ) values ($1, $2, $3, $4, $5, now(), now())
         on conflict (user_id, group_id) do update set
           ticker = excluded.ticker,
           entry_price = excluded.entry_price,
           banked_growth_factor = excluded.banked_growth_factor,
           updated_at = now()`,
        [
          student.id,
          student.groupId,
          student.ticker,
          student.entryPrice,
          student.bankedGrowthFactor,
        ],
      );
    }

    await client.query("commit");
    return { seeded: true, studentCount: students.length, schoolCount };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function countCampusSeedUsersInDb(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const result = await query<{ count: string }>(
    `select count(*)::text as count from users where id like $1`,
    [`${CAMPUS_SEED_ID_PREFIX}%`],
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Read-path guard: only rewrite campus seeds when missing.
 * Avoids rewriting 75 rows on every Community standings GET.
 */
export async function ensureCampusPickSeedsIfNeeded(): Promise<{
  seeded: boolean;
  studentCount: number;
  schoolCount: number;
  skipped: boolean;
}> {
  const students = listCampusSeedStudents();
  const schoolCount = new Set(students.map((row) => row.groupId)).size;

  if (!isDatabaseConfigured()) {
    return { seeded: false, studentCount: students.length, schoolCount, skipped: true };
  }

  const seedIds = students.map((row) => row.id);
  const users = await query<{ count: string }>(
    `select count(*)::text as count from users where id = any($1::text[])`,
    [seedIds],
  );
  const userCount = Number(users.rows[0]?.count ?? 0);
  if (userCount < seedIds.length) {
    const result = await ensureCampusPickSeeds();
    return { ...result, skipped: false };
  }

  const picks = await query<{ count: string }>(
    `select count(*)::text as count
     from community_picks
     where user_id = any($1::text[])`,
    [seedIds],
  );
  const pickCount = Number(picks.rows[0]?.count ?? 0);
  if (pickCount < seedIds.length) {
    const result = await ensureCampusPickSeeds();
    return { ...result, skipped: false };
  }

  return { seeded: false, studentCount: userCount, schoolCount, skipped: true };
}
