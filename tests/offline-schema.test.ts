import assert from 'node:assert/strict';
import test from 'node:test';
import { OFFLINE_DATABASE_NAME, OFFLINE_OWNER_TABLES, OFFLINE_PAYMENT_CAPTURE_ENABLED, OFFLINE_REQUIRED_TABLES, OFFLINE_SCHEMA_VERSION } from '../src/lib/offlineSchema.ts';

test('offline schema contract is versioned and includes every Phase 7 entity', () => {
  assert.equal(OFFLINE_DATABASE_NAME, 'nmmpc-offline.db');
  assert.ok(OFFLINE_SCHEMA_VERSION >= 3);
  const required = new Set(OFFLINE_REQUIRED_TABLES);
  for (const table of ['offline_customers', 'offline_meters', 'offline_meter_assignments', 'offline_meter_readings', 'offline_tariffs', 'offline_tariff_tiers', 'offline_reading_drafts', 'offline_meter_photos', 'offline_invoices', 'sync_queue', 'offline_schema_migrations']) assert.ok(required.has(table as never), table);
  assert.equal(required.size, OFFLINE_REQUIRED_TABLES.length);
});

test('every owner-scoped table is cleared during employee offboarding', () => {
  assert.ok(OFFLINE_OWNER_TABLES.includes('offline_customers'));
  assert.ok(OFFLINE_OWNER_TABLES.includes('offline_invoices'));
  assert.ok(OFFLINE_OWNER_TABLES.includes('sync_queue'));
  assert.ok(!OFFLINE_OWNER_TABLES.includes('offline_schema_migrations' as never));
});

test('offline payment capture is explicitly disabled', () => {
  assert.equal(OFFLINE_PAYMENT_CAPTURE_ENABLED, false);
});
