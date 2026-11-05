-- NMMPC Smart Water Meter Reading and Billing System
-- Initial database schema. Apply through the Supabase CLI or SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('employee', 'administrator');
create type public.customer_status as enum ('active', 'suspended', 'closed');
create type public.meter_status as enum ('active', 'inactive', 'replaced', 'damaged');
create type public.meter_condition as enum ('normal', 'rollover', 'replaced', 'unreadable');
create type public.invoice_status as enum ('draft', 'finalized', 'partially_paid', 'paid', 'overdue', 'void');
create type public.payment_status as enum ('pending', 'completed', 'failed', 'reversed');
create type public.payment_method as enum ('cash', 'bank_transfer', 'e_wallet', 'check', 'other');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  employee_code text unique,
  full_name text not null,
  role public.user_role not null default 'employee',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint profiles_employee_code_format check (
    employee_code is null or employee_code ~ '^[A-Z0-9-]{3,32}$'
  )
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  account_number text not null unique,
  full_name text not null,
  service_address text not null,
  phone text,
  email text,
  status public.customer_status not null default 'active',
  assigned_employee_id uuid references public.profiles (id) on delete set null,
  route_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint customers_account_number_not_blank check (btrim(account_number) <> ''),
  constraint customers_full_name_not_blank check (btrim(full_name) <> ''),
  constraint customers_service_address_not_blank check (btrim(service_address) <> '')
);

create table public.meters (
  id uuid primary key default gen_random_uuid(),
  meter_number text not null unique,
  serial_number text unique,
  qr_code text unique,
  manufacturer text,
  model text,
  status public.meter_status not null default 'active',
  installed_at date,
  initial_reading numeric(14, 3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint meters_meter_number_not_blank check (btrim(meter_number) <> ''),
  constraint meters_initial_reading_nonnegative check (initial_reading >= 0)
);

create table public.meter_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  meter_id uuid not null references public.meters (id) on delete restrict,
  assigned_by uuid references public.profiles (id) on delete set null,
  started_at date not null default current_date,
  ended_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meter_assignments_date_order check (ended_at is null or ended_at >= started_at),
  constraint meter_assignments_period_unique unique (customer_id, meter_id, started_at)
);

create table public.meter_readings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  meter_id uuid not null references public.meters (id) on delete restrict,
  employee_id uuid not null references public.profiles (id) on delete restrict,
  previous_reading numeric(14, 3) not null,
  current_reading numeric(14, 3) not null,
  consumption numeric(14, 3) not null,
  condition public.meter_condition not null default 'normal',
  billing_period_start date not null,
  billing_period_end date not null,
  read_at timestamptz not null default now(),
  photo_path text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  notes text,
  client_operation_id uuid not null default gen_random_uuid() unique,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meter_readings_values_nonnegative check (
    previous_reading >= 0 and current_reading >= 0 and consumption >= 0
  ),
  constraint meter_readings_period_order check (billing_period_end >= billing_period_start),
  constraint meter_readings_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint meter_readings_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint meter_readings_period_unique unique (meter_id, billing_period_start, billing_period_end)
);

create table public.tariffs (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  version integer not null,
  effective_from date not null,
  effective_to date,
  fixed_charge numeric(12, 2) not null default 0,
  currency char(3) not null default 'PHP',
  is_approved boolean not null default false,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint tariffs_code_version_unique unique (code, version),
  constraint tariffs_version_positive check (version > 0),
  constraint tariffs_date_order check (effective_to is null or effective_to >= effective_from),
  constraint tariffs_fixed_charge_nonnegative check (fixed_charge >= 0),
  constraint tariffs_approval_consistent check (
    (not is_approved and approved_at is null) or (is_approved and approved_at is not null)
  )
);

create table public.tariff_tiers (
  id uuid primary key default gen_random_uuid(),
  tariff_id uuid not null references public.tariffs (id) on delete cascade,
  minimum_volume numeric(14, 3) not null,
  maximum_volume numeric(14, 3),
  rate_per_unit numeric(12, 4) not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tariff_tiers_sort_unique unique (tariff_id, sort_order),
  constraint tariff_tiers_minimum_nonnegative check (minimum_volume >= 0),
  constraint tariff_tiers_maximum_valid check (
    maximum_volume is null or maximum_volume > minimum_volume
  ),
  constraint tariff_tiers_rate_nonnegative check (rate_per_unit >= 0),
  constraint tariff_tiers_sort_positive check (sort_order > 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  meter_reading_id uuid not null unique references public.meter_readings (id) on delete restrict,
  tariff_id uuid not null references public.tariffs (id) on delete restrict,
  billing_period_start date not null,
  billing_period_end date not null,
  issued_at timestamptz not null default now(),
  due_date date not null,
  subtotal numeric(12, 2) not null,
  fixed_charges numeric(12, 2) not null default 0,
  discounts numeric(12, 2) not null default 0,
  taxes numeric(12, 2) not null default 0,
  penalties numeric(12, 2) not null default 0,
  previous_balance numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null,
  status public.invoice_status not null default 'draft',
  tariff_snapshot jsonb not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  finalized_at timestamptz,
  client_operation_id uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint invoices_number_not_blank check (btrim(invoice_number) <> ''),
  constraint invoices_period_order check (billing_period_end >= billing_period_start),
  constraint invoices_due_date_valid check (due_date >= billing_period_end),
  constraint invoices_amounts_nonnegative check (
    subtotal >= 0 and fixed_charges >= 0 and discounts >= 0 and taxes >= 0
    and penalties >= 0 and previous_balance >= 0 and total_amount >= 0
  ),
  constraint invoices_finalized_consistent check (
    (status = 'draft' and finalized_at is null) or (status <> 'draft' and finalized_at is not null)
  )
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  item_type text not null,
  description text not null,
  quantity numeric(14, 3) not null default 1,
  unit_price numeric(12, 4) not null default 0,
  amount numeric(12, 2) not null,
  sort_order integer not null default 1,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_items_sort_unique unique (invoice_id, sort_order),
  constraint invoice_items_description_not_blank check (btrim(description) <> ''),
  constraint invoice_items_quantity_nonnegative check (quantity >= 0),
  constraint invoice_items_sort_positive check (sort_order > 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  amount numeric(12, 2) not null,
  method public.payment_method not null,
  reference_number text unique,
  status public.payment_status not null default 'completed',
  paid_at timestamptz not null default now(),
  received_by uuid not null references public.profiles (id) on delete restrict,
  client_operation_id uuid not null default gen_random_uuid() unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount > 0)
);

create table public.printer_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  bluetooth_address text not null,
  model text,
  paper_width_mm smallint not null default 58,
  is_default boolean not null default false,
  last_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint printer_devices_owner_address_unique unique (owner_id, bluetooth_address),
  constraint printer_devices_paper_width check (paper_width_mm in (58, 80))
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_entity_type_not_blank check (btrim(entity_type) <> '')
);

-- Only one active assignment for each customer and each meter.
create unique index meter_assignments_one_active_customer_idx
  on public.meter_assignments (customer_id) where ended_at is null;
create unique index meter_assignments_one_active_meter_idx
  on public.meter_assignments (meter_id) where ended_at is null;
create unique index printer_devices_one_default_per_owner_idx
  on public.printer_devices (owner_id) where is_default;

-- Mobile search, authorization, billing, and synchronization indexes.
create index profiles_role_active_idx on public.profiles (role, is_active) where archived_at is null;
create index customers_assigned_employee_idx on public.customers (assigned_employee_id) where archived_at is null;
create index customers_route_idx on public.customers (route_code) where archived_at is null;
create index customers_name_search_idx on public.customers using gin (to_tsvector('simple', full_name));
create index meters_number_search_idx on public.meters (meter_number) where archived_at is null;
create index meter_assignments_customer_idx on public.meter_assignments (customer_id, started_at desc);
create index meter_assignments_meter_idx on public.meter_assignments (meter_id, started_at desc);
create index meter_readings_customer_date_idx on public.meter_readings (customer_id, read_at desc);
create index meter_readings_employee_date_idx on public.meter_readings (employee_id, read_at desc);
create index meter_readings_unsynced_idx on public.meter_readings (created_at) where synced_at is null;
create index tariffs_effective_dates_idx on public.tariffs (effective_from desc, effective_to) where archived_at is null;
create index tariff_tiers_tariff_idx on public.tariff_tiers (tariff_id, sort_order);
create index invoices_customer_date_idx on public.invoices (customer_id, issued_at desc) where archived_at is null;
create index invoices_status_due_idx on public.invoices (status, due_date) where archived_at is null;
create index payments_invoice_date_idx on public.payments (invoice_id, paid_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger meters_set_updated_at before update on public.meters
  for each row execute function public.set_updated_at();
create trigger meter_assignments_set_updated_at before update on public.meter_assignments
  for each row execute function public.set_updated_at();
create trigger meter_readings_set_updated_at before update on public.meter_readings
  for each row execute function public.set_updated_at();
create trigger tariffs_set_updated_at before update on public.tariffs
  for each row execute function public.set_updated_at();
create trigger tariff_tiers_set_updated_at before update on public.tariff_tiers
  for each row execute function public.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger invoice_items_set_updated_at before update on public.invoice_items
  for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger printer_devices_set_updated_at before update on public.printer_devices
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'New employee'))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Secure-by-default Data API access. Policies are added in the authorization migration.
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.meters enable row level security;
alter table public.meter_assignments enable row level security;
alter table public.meter_readings enable row level security;
alter table public.tariffs enable row level security;
alter table public.tariff_tiers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.printer_devices enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

comment on table public.audit_logs is 'Append-only application audit trail. Client policies must never permit updates or deletes.';
comment on column public.meter_readings.client_operation_id is 'Client-generated idempotency key for offline synchronization.';
comment on column public.invoices.tariff_snapshot is 'Immutable snapshot of the tariff and calculation inputs applied to this invoice.';
