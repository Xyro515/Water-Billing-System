import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import type { Tables } from '../types/database.types';
import type { CustomerDetail, CustomerListItem } from './customers';
import { OFFLINE_DATABASE_NAME, OFFLINE_OWNER_TABLES, OFFLINE_PAYMENT_CAPTURE_ENABLED, OFFLINE_REQUIRED_TABLES, OFFLINE_SCHEMA_VERSION } from '../lib/offlineSchema';
import type { WaterBillReceipt } from '../lib/receipt';
import { nextRetryAt } from '../lib/syncPolicy';

const PAGE_SIZE = 20;
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function isClosedDatabaseError(reason: unknown) {
  return reason instanceof Error && /access to closed resource|closed database|database is closed/i.test(reason.message);
}

async function withOfflineTransactionAsync(
  database: SQLite.SQLiteDatabase,
  task: (transaction: SQLite.SQLiteDatabase) => Promise<void>,
) {
  if (Platform.OS === 'web') {
    await database.withTransactionAsync(() => task(database));
    return;
  }
  await database.withExclusiveTransactionAsync(task);
}

export type SyncEntity = 'meter_reading' | 'invoice' | 'payment' | 'meter_photo';
export type SyncAction = 'insert' | 'update' | 'upload';
export type SyncQueueItem = {
  operation_id: string;
  owner_id: string;
  entity_type: SyncEntity;
  entity_id: string;
  action: SyncAction;
  payload: string;
  retry_count: number;
  next_attempt_at: string;
  status: 'pending' | 'processing' | 'permanent_failure';
  last_error: string | null;
};

function createOperationId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some(Boolean)) for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function migrate(database: SQLite.SQLiteDatabase) {
  // These connection-level PRAGMAs must run before the migration transaction.
  // SQLite cannot change journal mode while a transaction is active.
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);
  const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) >= OFFLINE_SCHEMA_VERSION) return;
  await withOfflineTransactionAsync(database, async (transaction) => {
    await transaction.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_customers (
        owner_id TEXT NOT NULL, id TEXT NOT NULL, full_name TEXT NOT NULL,
        account_number TEXT NOT NULL, meter_search TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
        payload TEXT NOT NULL, cached_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      CREATE INDEX IF NOT EXISTS offline_customers_search_idx
        ON offline_customers (owner_id, full_name, account_number, meter_search);
      CREATE TABLE IF NOT EXISTS offline_meters (
        owner_id TEXT NOT NULL, id TEXT NOT NULL, meter_number TEXT NOT NULL,
        serial_number TEXT, qr_code TEXT, payload TEXT NOT NULL, cached_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS offline_meters_qr_idx ON offline_meters (owner_id, qr_code) WHERE qr_code IS NOT NULL;
      CREATE TABLE IF NOT EXISTS offline_meter_assignments (
        owner_id TEXT NOT NULL, id TEXT NOT NULL, customer_id TEXT NOT NULL, meter_id TEXT NOT NULL,
        started_at TEXT NOT NULL, ended_at TEXT, payload TEXT NOT NULL, cached_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      CREATE INDEX IF NOT EXISTS offline_assignments_customer_idx ON offline_meter_assignments (owner_id, customer_id, started_at DESC);
      CREATE TABLE IF NOT EXISTS offline_meter_readings (
        owner_id TEXT NOT NULL, id TEXT NOT NULL, customer_id TEXT NOT NULL, meter_id TEXT NOT NULL,
        read_at TEXT NOT NULL, current_reading REAL NOT NULL, billing_period_end TEXT NOT NULL,
        payload TEXT NOT NULL, cached_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      CREATE INDEX IF NOT EXISTS offline_readings_customer_idx ON offline_meter_readings (owner_id, customer_id, read_at DESC);
      CREATE TABLE IF NOT EXISTS offline_tariffs (
        owner_id TEXT NOT NULL, id TEXT NOT NULL, code TEXT NOT NULL, version INTEGER NOT NULL,
        effective_from TEXT NOT NULL, effective_to TEXT, payload TEXT NOT NULL, cached_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      CREATE INDEX IF NOT EXISTS offline_tariffs_effective_idx ON offline_tariffs (owner_id, code, effective_from DESC);
      CREATE TABLE IF NOT EXISTS offline_tariff_tiers (
        owner_id TEXT NOT NULL, id TEXT NOT NULL, tariff_id TEXT NOT NULL, sort_order INTEGER NOT NULL,
        payload TEXT NOT NULL, cached_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      CREATE INDEX IF NOT EXISTS offline_tariff_tiers_tariff_idx ON offline_tariff_tiers (owner_id, tariff_id, sort_order);
      CREATE TABLE IF NOT EXISTS offline_reading_drafts (
        owner_id TEXT NOT NULL, customer_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, customer_id)
      );
      CREATE TABLE IF NOT EXISTS offline_meter_photos (
        owner_id TEXT NOT NULL, id TEXT NOT NULL, customer_id TEXT NOT NULL, local_uri TEXT NOT NULL,
        upload_status TEXT NOT NULL DEFAULT 'pending', payload TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      CREATE TABLE IF NOT EXISTS offline_invoices (
        owner_id TEXT NOT NULL, id TEXT NOT NULL, customer_id TEXT NOT NULL, status TEXT NOT NULL,
        payload TEXT NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      CREATE TABLE IF NOT EXISTS offline_payments (
        owner_id TEXT NOT NULL, id TEXT NOT NULL, invoice_id TEXT NOT NULL, status TEXT NOT NULL,
        payload TEXT NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      CREATE TABLE IF NOT EXISTS sync_queue (
        operation_id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL, action TEXT NOT NULL, payload TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', last_error TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE (owner_id, entity_type, entity_id, action)
      );
      CREATE INDEX IF NOT EXISTS sync_queue_ready_idx ON sync_queue (owner_id, status, next_attempt_at);
      CREATE TABLE IF NOT EXISTS offline_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS offline_schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO offline_schema_migrations (version, applied_at) VALUES (3, CURRENT_TIMESTAMP);
      PRAGMA user_version = 3;
    `);
  });
}

async function validateOfflineDatabaseSchema(database: SQLite.SQLiteDatabase) {
  const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (version?.user_version !== OFFLINE_SCHEMA_VERSION) throw new Error(`Offline database migration incomplete: expected version ${OFFLINE_SCHEMA_VERSION}.`);
  const rows = await database.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
  const names = new Set(rows.map((row) => row.name));
  const missing = OFFLINE_REQUIRED_TABLES.filter((table) => !names.has(table));
  if (missing.length) throw new Error(`Offline database is missing tables: ${missing.join(', ')}.`);
}

export async function getOfflineDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(OFFLINE_DATABASE_NAME, { useNewConnection: true })
      .then(async (database) => { await migrate(database); await validateOfflineDatabaseSchema(database); return database; })
      .catch((error) => {
        databasePromise = null;
        throw error;
      });
  }
  try {
    const database = await databasePromise;
    // Fast Refresh can invalidate a native SharedObject while its JavaScript
    // promise remains cached. A lightweight probe lets us reopen that handle.
    await database.getFirstAsync('SELECT 1');
    return database;
  } catch (reason) {
    if (!isClosedDatabaseError(reason)) throw reason;
    databasePromise = null;
    const database = await SQLite.openDatabaseAsync(OFFLINE_DATABASE_NAME, { useNewConnection: true });
    await migrate(database);
    await validateOfflineDatabaseSchema(database);
    databasePromise = Promise.resolve(database);
    return database;
  }
}

export async function initializeOfflineDatabase() { await getOfflineDatabase(); }

export async function getOfflineDatabaseDiagnostics(ownerId: string) {
  const database = await getOfflineDatabase();
  const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const journal = await database.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode');
  const foreignKeys = await database.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  const rowCounts: Record<string, number> = {};
  for (const table of OFFLINE_OWNER_TABLES) {
    const row = await database.getFirstAsync<{ total: number }>(`SELECT count(*) AS total FROM ${table} WHERE owner_id=?`, ownerId);
    rowCounts[table] = row?.total ?? 0;
  }
  return { version: version?.user_version ?? 0, journalMode: journal?.journal_mode ?? 'unknown', foreignKeysEnabled: foreignKeys?.foreign_keys === 1, rowCounts };
}

export async function cacheCustomerPage(ownerId: string, customers: CustomerListItem[]) {
  const database = await getOfflineDatabase(); const now = new Date().toISOString();
  await withOfflineTransactionAsync(database, async (transaction) => {
    for (const customer of customers) {
      await transaction.runAsync(`INSERT INTO offline_customers (owner_id,id,full_name,account_number,meter_search,status,payload,cached_at)
        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET full_name=excluded.full_name,account_number=excluded.account_number,meter_search=excluded.meter_search,status=excluded.status,payload=excluded.payload,cached_at=excluded.cached_at`, ownerId, customer.id, customer.full_name, customer.account_number, `${customer.meter?.meter_number ?? ''} ${customer.meter?.serial_number ?? ''}`, customer.status, JSON.stringify(customer), now);
      if (customer.meter) await cacheMeter(transaction, ownerId, customer.meter, now);
      if (customer.assignment) await cacheMeterAssignment(transaction, ownerId, customer.assignment, now);
      if (customer.latestReading) await cacheMeterReading(transaction, ownerId, customer.latestReading, now);
    }
  });
}

async function cacheMeter(database: SQLite.SQLiteDatabase, ownerId: string, meter: Tables<'meters'>, now: string) {
  await database.runAsync(`INSERT INTO offline_meters (owner_id,id,meter_number,serial_number,qr_code,payload,cached_at) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(owner_id,id) DO UPDATE SET meter_number=excluded.meter_number,serial_number=excluded.serial_number,qr_code=excluded.qr_code,payload=excluded.payload,cached_at=excluded.cached_at`, ownerId, meter.id, meter.meter_number, meter.serial_number, meter.qr_code, JSON.stringify(meter), now);
}

async function cacheMeterAssignment(database: SQLite.SQLiteDatabase, ownerId: string, assignment: Tables<'meter_assignments'>, now: string) {
  await database.runAsync(`INSERT INTO offline_meter_assignments (owner_id,id,customer_id,meter_id,started_at,ended_at,payload,cached_at) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(owner_id,id) DO UPDATE SET ended_at=excluded.ended_at,payload=excluded.payload,cached_at=excluded.cached_at`, ownerId, assignment.id, assignment.customer_id, assignment.meter_id, assignment.started_at, assignment.ended_at, JSON.stringify(assignment), now);
}

async function cacheMeterReading(database: SQLite.SQLiteDatabase, ownerId: string, reading: Tables<'meter_readings'>, now: string) {
  await database.runAsync(`INSERT INTO offline_meter_readings (owner_id,id,customer_id,meter_id,read_at,current_reading,billing_period_end,payload,cached_at) VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(owner_id,id) DO UPDATE SET read_at=excluded.read_at,current_reading=excluded.current_reading,billing_period_end=excluded.billing_period_end,payload=excluded.payload,cached_at=excluded.cached_at`, ownerId, reading.id, reading.customer_id, reading.meter_id, reading.read_at, reading.current_reading, reading.billing_period_end, JSON.stringify(reading), now);
}

export async function loadCachedCustomerPage(ownerId: string, query: string, page: number) {
  const database = await getOfflineDatabase(); const normalized = `%${query.trim().toLowerCase()}%`; const offset = page * PAGE_SIZE;
  const where = query.trim() ? 'AND (lower(full_name) LIKE ? OR lower(account_number) LIKE ? OR lower(meter_search) LIKE ?)' : '';
  const parameters: (string | number)[] = query.trim() ? [ownerId, normalized, normalized, normalized, PAGE_SIZE, offset] : [ownerId, PAGE_SIZE, offset];
  const rows = await database.getAllAsync<{ payload: string }>(`SELECT payload FROM offline_customers WHERE owner_id=? ${where} ORDER BY full_name LIMIT ? OFFSET ?`, parameters);
  const countParameters = query.trim() ? [ownerId, normalized, normalized, normalized] : [ownerId];
  const count = await database.getFirstAsync<{ total: number }>(`SELECT count(*) AS total FROM offline_customers WHERE owner_id=? ${where}`, countParameters);
  return { items: rows.map((row) => JSON.parse(row.payload) as CustomerListItem), count: count?.total ?? 0, source: 'cache' as const };
}

export async function cacheCustomerDetail(ownerId: string, detail: CustomerDetail) {
  const database = await getOfflineDatabase(); const now = new Date().toISOString();
  await withOfflineTransactionAsync(database, async (transaction) => {
    for (const assignment of detail.assignments) {
      await cacheMeter(transaction, ownerId, assignment.meter, now);
      await cacheMeterAssignment(transaction, ownerId, assignment, now);
    }
    for (const reading of detail.readings) await cacheMeterReading(transaction, ownerId, reading, now);
    const active = detail.assignments.find((assignment) => !assignment.ended_at)?.meter ?? null;
    await transaction.runAsync(`INSERT INTO offline_customers (owner_id,id,full_name,account_number,meter_search,status,payload,cached_at) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(owner_id,id) DO UPDATE SET full_name=excluded.full_name,account_number=excluded.account_number,meter_search=excluded.meter_search,status=excluded.status,payload=excluded.payload,cached_at=excluded.cached_at`, ownerId, detail.id, detail.full_name, detail.account_number, `${active?.meter_number ?? ''} ${active?.serial_number ?? ''}`, detail.status, JSON.stringify({ ...detail, meter: active, latestReading: detail.readings[0] ?? null }), now);
    await transaction.runAsync('INSERT INTO offline_metadata (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', `customer-detail:${ownerId}:${detail.id}`, JSON.stringify(detail));
  });
}

export async function loadCachedCustomerDetail(ownerId: string, customerId: string) {
  const database = await getOfflineDatabase(); const row = await database.getFirstAsync<{ value: string }>('SELECT value FROM offline_metadata WHERE key=?', `customer-detail:${ownerId}:${customerId}`);
  return row ? JSON.parse(row.value) as CustomerDetail : null;
}

export async function findCachedAssignedCustomerByQr(ownerId: string, value: string) {
  const database = await getOfflineDatabase(); const encodedId = value.trim().match(/^nmmpc:meter:([0-9a-f-]{36})$/i)?.[1];
  const meter = encodedId
    ? await database.getFirstAsync<{ id: string; payload: string }>('SELECT id,payload FROM offline_meters WHERE owner_id=? AND id=?', ownerId, encodedId)
    : await database.getFirstAsync<{ id: string; payload: string }>('SELECT id,payload FROM offline_meters WHERE owner_id=? AND (qr_code=? OR meter_number=?)', ownerId, value.trim(), value.trim());
  if (!meter) return null;
  const assignment = await database.getFirstAsync<{ customer_id: string }>('SELECT customer_id FROM offline_meter_assignments WHERE owner_id=? AND meter_id=? AND ended_at IS NULL', ownerId, meter.id);
  return assignment ? { customerId: assignment.customer_id, meter: JSON.parse(meter.payload) as Tables<'meters'> } : null;
}

export async function cacheApprovedTariffs(ownerId: string, tariffs: Tables<'tariffs'>[], tiers: Tables<'tariff_tiers'>[]) {
  const database = await getOfflineDatabase(); const now = new Date().toISOString();
  await withOfflineTransactionAsync(database, async (transaction) => { for (const tariff of tariffs) await transaction.runAsync(`INSERT INTO offline_tariffs (owner_id,id,code,version,effective_from,effective_to,payload,cached_at) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(owner_id,id) DO UPDATE SET version=excluded.version,effective_from=excluded.effective_from,effective_to=excluded.effective_to,payload=excluded.payload,cached_at=excluded.cached_at`, ownerId, tariff.id, tariff.code, tariff.version, tariff.effective_from, tariff.effective_to, JSON.stringify(tariff), now);
    for (const tier of tiers) await transaction.runAsync(`INSERT INTO offline_tariff_tiers (owner_id,id,tariff_id,sort_order,payload,cached_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(owner_id,id) DO UPDATE SET sort_order=excluded.sort_order,payload=excluded.payload,cached_at=excluded.cached_at`, ownerId, tier.id, tier.tariff_id, tier.sort_order, JSON.stringify(tier), now);
  });
}

export async function getCachedApprovedTariff(ownerId: string, code: string, billingDate: string) {
  const database = await getOfflineDatabase(); const row = await database.getFirstAsync<{ payload: string }>(`SELECT payload FROM offline_tariffs WHERE owner_id=? AND code=? AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?) ORDER BY version DESC LIMIT 1`, ownerId, code, billingDate, billingDate);
  if (!row) return null;
  const tariff = JSON.parse(row.payload) as Tables<'tariffs'>;
  const tiers = await database.getAllAsync<{ payload: string }>('SELECT payload FROM offline_tariff_tiers WHERE owner_id=? AND tariff_id=? ORDER BY sort_order', ownerId, tariff.id);
  return { tariff, tiers: tiers.map((tier) => JSON.parse(tier.payload) as Tables<'tariff_tiers'>) };
}

export async function saveOfflineRecord(ownerId: string, kind: 'reading_draft' | 'meter_photo' | 'invoice' | 'payment', id: string, payload: unknown) {
  if (kind === 'payment' && !OFFLINE_PAYMENT_CAPTURE_ENABLED) throw new Error('Offline payment capture is not permitted. Record payments only while connected.');
  const database = await getOfflineDatabase(); const now = new Date().toISOString(); const serialized = JSON.stringify(payload);
  if (kind === 'reading_draft') await database.runAsync('INSERT INTO offline_reading_drafts (owner_id,customer_id,payload,updated_at) VALUES (?,?,?,?) ON CONFLICT(owner_id,customer_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at', ownerId, id, serialized, now);
  else if (kind === 'meter_photo') await database.runAsync('INSERT INTO offline_meter_photos (owner_id,id,customer_id,local_uri,upload_status,payload,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET local_uri=excluded.local_uri,upload_status=excluded.upload_status,payload=excluded.payload', ownerId, id, String((payload as { customerId?: string }).customerId ?? ''), String((payload as { localUri?: string }).localUri ?? ''), String((payload as { uploadStatus?: string }).uploadStatus ?? 'pending'), serialized, now);
  else if (kind === 'invoice') await database.runAsync('INSERT INTO offline_invoices (owner_id,id,customer_id,status,payload,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET status=excluded.status,payload=excluded.payload,updated_at=excluded.updated_at', ownerId, id, String((payload as { customer_id?: string }).customer_id ?? ''), String((payload as { status?: string }).status ?? 'draft'), serialized, now);
  else await database.runAsync('INSERT INTO offline_payments (owner_id,id,invoice_id,status,payload,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_id,id) DO UPDATE SET status=excluded.status,payload=excluded.payload,updated_at=excluded.updated_at', ownerId, id, String((payload as { invoice_id?: string }).invoice_id ?? ''), String((payload as { status?: string }).status ?? 'pending'), serialized, now);
}

export async function loadOfflineReadingDraft(ownerId: string, customerId: string) {
  const database = await getOfflineDatabase();
  const row = await database.getFirstAsync<{ payload: string }>('SELECT payload FROM offline_reading_drafts WHERE owner_id=? AND customer_id=?', ownerId, customerId);
  return row ? JSON.parse(row.payload) as import('./storage').ReadingDraft : null;
}

export async function removeOfflineReadingDraft(ownerId: string, customerId: string) {
  const database = await getOfflineDatabase();
  await database.runAsync('DELETE FROM offline_reading_drafts WHERE owner_id=? AND customer_id=?', ownerId, customerId);
}

export async function saveOfflineInvoiceReceipt(ownerId: string, customerId: string, invoiceId: string, status: string, receipt: WaterBillReceipt) {
  await saveOfflineRecord(ownerId, 'invoice', invoiceId, { customer_id: customerId, status, receipt });
}

export async function saveOfflineProvisionalBilling(ownerId: string, readingId: string, reading: Record<string, unknown>, provisionalInvoiceId: string, payload: Record<string, unknown>) {
  const database = await getOfflineDatabase(); const now = new Date().toISOString(); const queueOperationId = createOperationId();
  await withOfflineTransactionAsync(database, async (transaction) => {
    await transaction.runAsync(`INSERT INTO offline_meter_readings (owner_id,id,customer_id,meter_id,read_at,current_reading,billing_period_end,payload,cached_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(owner_id,id) DO UPDATE SET read_at=excluded.read_at,current_reading=excluded.current_reading,billing_period_end=excluded.billing_period_end,payload=excluded.payload,cached_at=excluded.cached_at`, ownerId, readingId, String(reading.customer_id ?? ''), String(reading.meter_id ?? ''), String(reading.read_at ?? now), Number(reading.current_reading ?? 0), String(reading.billing_period_end ?? ''), JSON.stringify(reading), now);
    await transaction.runAsync(`INSERT INTO offline_invoices (owner_id,id,customer_id,status,payload,updated_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(owner_id,id) DO UPDATE SET status=excluded.status,payload=excluded.payload,updated_at=excluded.updated_at`, ownerId, provisionalInvoiceId, String(payload.customer_id ?? ''), 'provisional', JSON.stringify(payload), now);
    await transaction.runAsync(`INSERT INTO sync_queue (operation_id,owner_id,entity_type,entity_id,action,payload,next_attempt_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(owner_id,entity_type,entity_id,action) DO UPDATE SET payload=excluded.payload,status='pending',last_error=NULL,next_attempt_at=excluded.next_attempt_at,updated_at=excluded.updated_at`, queueOperationId, ownerId, 'invoice', provisionalInvoiceId, 'insert', JSON.stringify(payload), now, now, now);
  });
}

export async function loadOfflineInvoiceReceipt(ownerId: string, invoiceId: string) {
  const database = await getOfflineDatabase();
  const row = await database.getFirstAsync<{ payload: string }>('SELECT payload FROM offline_invoices WHERE owner_id=? AND id=?', ownerId, invoiceId);
  if (!row) return null;
  const payload = JSON.parse(row.payload) as { receipt?: WaterBillReceipt };
  return payload.receipt ?? null;
}

export async function enqueueSyncOperation(ownerId: string, entityType: SyncEntity, entityId: string, action: SyncAction, payload: unknown) {
  const database = await getOfflineDatabase(); const now = new Date().toISOString(); const operationId = createOperationId();
  await database.runAsync(`INSERT INTO sync_queue (operation_id,owner_id,entity_type,entity_id,action,payload,next_attempt_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(owner_id,entity_type,entity_id,action) DO UPDATE SET payload=excluded.payload,status='pending',last_error=NULL,next_attempt_at=excluded.next_attempt_at,updated_at=excluded.updated_at`, operationId, ownerId, entityType, entityId, action, JSON.stringify(payload), now, now, now);
  return operationId;
}

export async function saveAndQueueOfflineMutation(ownerId: string, entityType: SyncEntity, entityId: string, payload: Record<string, unknown>) {
  if (entityType === 'payment' && !OFFLINE_PAYMENT_CAPTURE_ENABLED) throw new Error('Offline payment capture is not permitted. Record payments only while connected.');
  const operationId = String(payload.client_operation_id ?? createOperationId());
  const nextPayload: Record<string, unknown> = { ...payload, client_operation_id: operationId };
  if (entityType === 'meter_reading') {
    const database = await getOfflineDatabase(); const now = new Date().toISOString();
    await database.runAsync(`INSERT INTO offline_meter_readings (owner_id,id,customer_id,meter_id,read_at,current_reading,billing_period_end,payload,cached_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(owner_id,id) DO UPDATE SET read_at=excluded.read_at,current_reading=excluded.current_reading,billing_period_end=excluded.billing_period_end,payload=excluded.payload,cached_at=excluded.cached_at`, ownerId, entityId, String(nextPayload.customer_id ?? ''), String(nextPayload.meter_id ?? ''), String(nextPayload.read_at ?? now), Number(nextPayload.current_reading ?? 0), String(nextPayload.billing_period_end ?? ''), JSON.stringify(nextPayload), now);
  } else if (entityType === 'invoice') await saveOfflineRecord(ownerId, 'invoice', entityId, nextPayload);
  else if (entityType === 'payment') await saveOfflineRecord(ownerId, 'payment', entityId, nextPayload);
  else await saveOfflineRecord(ownerId, 'meter_photo', entityId, nextPayload);
  await enqueueSyncOperation(ownerId, entityType, entityId, entityType === 'meter_photo' ? 'upload' : 'insert', nextPayload);
  return operationId;
}

export async function getReadySyncOperations(ownerId: string, limit = 20) { const database = await getOfflineDatabase(); return database.getAllAsync<SyncQueueItem>(`SELECT * FROM sync_queue WHERE owner_id=? AND status='pending' AND next_attempt_at<=? ORDER BY created_at LIMIT ?`, ownerId, new Date().toISOString(), limit); }
export async function getPendingSyncCount(ownerId: string) { const database = await getOfflineDatabase(); const row = await database.getFirstAsync<{ total: number }>(`SELECT count(*) AS total FROM sync_queue WHERE owner_id=? AND status IN ('pending','processing')`, ownerId); return row?.total ?? 0; }
export async function getFailedSyncCount(ownerId: string) { const database = await getOfflineDatabase(); const row = await database.getFirstAsync<{ total: number }>(`SELECT count(*) AS total FROM sync_queue WHERE owner_id=? AND status='permanent_failure'`, ownerId); return row?.total ?? 0; }
export async function makePendingSyncOperationsReady(ownerId: string) { const database = await getOfflineDatabase(); const now = new Date().toISOString(); await database.runAsync("UPDATE sync_queue SET next_attempt_at=?,updated_at=? WHERE owner_id=? AND status='pending'", now, now, ownerId); }
export async function markSyncProcessing(operationId: string) { const database = await getOfflineDatabase(); await database.runAsync("UPDATE sync_queue SET status='processing',updated_at=? WHERE operation_id=? AND status='pending'", new Date().toISOString(), operationId); }
export async function resetInterruptedSyncOperations(ownerId: string) { const database = await getOfflineDatabase(); const now = new Date().toISOString(); await database.runAsync("UPDATE sync_queue SET status='pending',next_attempt_at=?,last_error=coalesce(last_error,'Synchronization was interrupted.'),updated_at=? WHERE owner_id=? AND status='processing'", now, now, ownerId); }
export async function markSyncComplete(operationId: string) { const database = await getOfflineDatabase(); await database.runAsync('DELETE FROM sync_queue WHERE operation_id=?', operationId); }
export async function markSyncFailed(item: SyncQueueItem, message: string, permanent: boolean) { const database = await getOfflineDatabase(); const retries = item.retry_count + 1; await database.runAsync(`UPDATE sync_queue SET retry_count=?,next_attempt_at=?,status=?,last_error=?,updated_at=? WHERE operation_id=?`, retries, nextRetryAt(retries), permanent ? 'permanent_failure' : 'pending', message.slice(0, 500), new Date().toISOString(), item.operation_id); }

export async function clearOfflineDataForOwner(ownerId: string) {
  const database = await getOfflineDatabase();
  await withOfflineTransactionAsync(database, async (transaction) => { for (const table of OFFLINE_OWNER_TABLES) await transaction.runAsync(`DELETE FROM ${table} WHERE owner_id=?`, ownerId); });
}
