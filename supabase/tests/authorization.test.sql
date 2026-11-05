begin;
select plan(17);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in (
      'profiles', 'customers', 'meters', 'meter_assignments', 'meter_readings', 'tariffs',
      'tariff_tiers', 'invoices', 'invoice_items', 'payments', 'printer_devices', 'audit_logs'
    ) and c.relrowsecurity),
  12,
  'RLS is enabled on every application table'
);

select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'profiles'), 3, 'profiles policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'customers'), 4, 'customers policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'meters'), 4, 'meters policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'meter_assignments'), 4, 'meter assignments policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'meter_readings'), 4, 'meter readings policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'tariffs'), 4, 'tariffs policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'tariff_tiers'), 4, 'tariff tiers policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'invoices'), 4, 'invoices policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'invoice_items'), 5, 'invoice items policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'payments'), 3, 'payments policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'printer_devices'), 5, 'printer devices policy set is complete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'audit_logs'), 1, 'audit logs policy set is complete');

select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anonymous users cannot execute authorization helpers'
);

select ok(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in (
      'profiles', 'customers', 'meters', 'meter_assignments', 'meter_readings', 'tariffs',
      'tariff_tiers', 'invoices', 'invoice_items', 'payments', 'printer_devices', 'audit_logs'
    ) and has_table_privilege('anon', c.oid, 'SELECT')
  ),
  'anonymous users have no table read grants'
);

select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('begin_invoice_print', 'complete_invoice_print')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anonymous users cannot call invoice print audit functions'
);

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('begin_invoice_print', 'complete_invoice_print')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  2,
  'authenticated users can call both protected invoice print audit functions'
);

select * from finish();
rollback;
