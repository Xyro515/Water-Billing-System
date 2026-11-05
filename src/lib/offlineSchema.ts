export const OFFLINE_SCHEMA_VERSION = 3;
export const OFFLINE_DATABASE_NAME = 'nmmpc-offline.db';
export const OFFLINE_PAYMENT_CAPTURE_ENABLED = false;

export const OFFLINE_OWNER_TABLES = [
  'offline_customers',
  'offline_meters',
  'offline_meter_assignments',
  'offline_meter_readings',
  'offline_tariff_tiers',
  'offline_tariffs',
  'offline_reading_drafts',
  'offline_meter_photos',
  'offline_invoices',
  'offline_payments',
  'sync_queue',
] as const;

export const OFFLINE_REQUIRED_TABLES = [
  ...OFFLINE_OWNER_TABLES,
  'offline_metadata',
  'offline_schema_migrations',
] as const;
