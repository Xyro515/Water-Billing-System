import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/20261106000000_auto_meter_numbers.sql", import.meta.url);
const accountMigrationUrl = new URL("../supabase/migrations/20261106010000_account_based_first_meter_numbers.sql", import.meta.url);

test("meter number migration uses a sequence-backed permanent NMMPC asset identifier", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create sequence if not exists public\.meter_number_seq/i);
  assert.match(sql, /'NMMPC-MTR-' \|\| lpad\(nextval\('public\.meter_number_seq'\)::text, 6, '0'\)/i);
  assert.match(sql, /before insert or update of meter_number on public\.meters/i);
});

test("meter replacement accepts an omitted number and keeps its operation atomic", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /new_meter_number text default null/i);
  assert.match(sql, /values \(created_meter_id, nullif\(btrim\(new_meter_number\), ''\)/i);
  assert.match(sql, /insert into public\.meter_assignments/i);
});

test("first meter numbers derive from ACC account identifiers without renumbering replacements", async () => {
  const sql = await readFile(accountMigrationUrl, "utf8");
  assert.match(sql, /'NMMPC-MTR-' \|\| lpad/i);
  assert.match(sql, /customer_order = 1 and meter_order = 1/i);
  assert.match(sql, /after insert on public\.meter_assignments/i);
  assert.match(sql, /meter\.number_backfilled_from_account/i);
  assert.match(sql, /meter\.account_number_conflict/i);
});
