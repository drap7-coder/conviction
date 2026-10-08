import { query } from "@/lib/db";
import type { ProductEvent } from "@/lib/product-analytics";

let ready: Promise<unknown> | null = null;
export async function ensureProductEventTable() {
  // Creates only this new aggregate table; does not run unrelated migrations.
  if (!ready) ready = query(`create table if not exists product_event_counts (
    event_date date not null,
    event_name text not null,
    event_count bigint not null default 0,
    primary key (event_date, event_name)
  )`).catch((error) => { ready = null; throw error; });
  await ready;
}

export async function countProductEvent(event: ProductEvent) {
  await ensureProductEventTable();
  await query(`insert into product_event_counts (event_date,event_name,event_count)
    values ((now() at time zone 'UTC')::date,$1,1)
    on conflict (event_date,event_name) do update
    set event_count=product_event_counts.event_count+1`, [event]);
}
