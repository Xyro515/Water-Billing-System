-- NMMPC authentication and authorization policies.
-- Authorization is derived from public.profiles, never user-editable metadata.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active
      and archived_at is null
  );
$$;

create or replace function private.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'administrator'
      and is_active
      and archived_at is null
  );
$$;

create or replace function private.can_access_customer(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_administrator()) or exists (
    select 1
    from public.customers
    where id = target_customer_id
      and assigned_employee_id = (select auth.uid())
      and archived_at is null
      and (select private.is_active_user())
  );
$$;

create or replace function private.can_access_meter(target_meter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_administrator()) or exists (
    select 1
    from public.meter_assignments assignment
    join public.customers customer on customer.id = assignment.customer_id
    where assignment.meter_id = target_meter_id
      and assignment.ended_at is null
      and customer.assigned_employee_id = (select auth.uid())
      and customer.archived_at is null
      and (select private.is_active_user())
  );
$$;

create or replace function private.can_access_invoice(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.invoices invoice
    where invoice.id = target_invoice_id
      and (select private.can_access_customer(invoice.customer_id))
  );
$$;

create or replace function private.can_manage_invoice(target_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_administrator()) or exists (
    select 1
    from public.invoices invoice
    where invoice.id = target_invoice_id
      and invoice.created_by = (select auth.uid())
      and invoice.status = 'draft'
      and (select private.can_access_customer(invoice.customer_id))
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Profiles: users can inspect their own account state; only active administrators
-- can read or change other employee profiles and role assignments.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_admin_select on public.profiles
  for select to authenticated
  using ((select private.is_administrator()));
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));

-- Customer accounts and meter assignments.
create policy customers_employee_select on public.customers
  for select to authenticated
  using ((select private.can_access_customer(id)));
create policy customers_admin_insert on public.customers
  for insert to authenticated
  with check ((select private.is_administrator()));
create policy customers_admin_update on public.customers
  for update to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));
create policy customers_admin_delete on public.customers
  for delete to authenticated
  using ((select private.is_administrator()));

create policy meters_assigned_select on public.meters
  for select to authenticated
  using ((select private.can_access_meter(id)));
create policy meters_admin_insert on public.meters
  for insert to authenticated
  with check ((select private.is_administrator()));
create policy meters_admin_update on public.meters
  for update to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));
create policy meters_admin_delete on public.meters
  for delete to authenticated
  using ((select private.is_administrator()));

create policy meter_assignments_assigned_select on public.meter_assignments
  for select to authenticated
  using ((select private.can_access_customer(customer_id)));
create policy meter_assignments_admin_insert on public.meter_assignments
  for insert to authenticated
  with check ((select private.is_administrator()));
create policy meter_assignments_admin_update on public.meter_assignments
  for update to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));
create policy meter_assignments_admin_delete on public.meter_assignments
  for delete to authenticated
  using ((select private.is_administrator()));

-- Employees may read readings for assigned accounts and create or correct only
-- readings attributed to themselves. Administrators retain full management.
create policy meter_readings_assigned_select on public.meter_readings
  for select to authenticated
  using ((select private.can_access_customer(customer_id)));
create policy meter_readings_employee_insert on public.meter_readings
  for insert to authenticated
  with check (
    employee_id = (select auth.uid())
    and (select private.can_access_customer(customer_id))
    and (select private.can_access_meter(meter_id))
  );
create policy meter_readings_employee_update on public.meter_readings
  for update to authenticated
  using (
    employee_id = (select auth.uid())
    and (select private.can_access_customer(customer_id))
  )
  with check (
    employee_id = (select auth.uid())
    and (select private.can_access_customer(customer_id))
    and (select private.can_access_meter(meter_id))
  );
create policy meter_readings_admin_all on public.meter_readings
  for all to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));

-- Employees can use only approved tariffs. Tariff management is administrator-only.
create policy tariffs_approved_select on public.tariffs
  for select to authenticated
  using (
    ((select private.is_active_user()) and is_approved and archived_at is null)
    or (select private.is_administrator())
  );
create policy tariffs_admin_insert on public.tariffs
  for insert to authenticated
  with check ((select private.is_administrator()));
create policy tariffs_admin_update on public.tariffs
  for update to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));
create policy tariffs_admin_delete on public.tariffs
  for delete to authenticated
  using ((select private.is_administrator()));

create policy tariff_tiers_approved_select on public.tariff_tiers
  for select to authenticated
  using (exists (
    select 1 from public.tariffs tariff
    where tariff.id = tariff_tiers.tariff_id
      and (
        ((select private.is_active_user()) and tariff.is_approved and tariff.archived_at is null)
        or (select private.is_administrator())
      )
  ));
create policy tariff_tiers_admin_insert on public.tariff_tiers
  for insert to authenticated
  with check ((select private.is_administrator()));
create policy tariff_tiers_admin_update on public.tariff_tiers
  for update to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));
create policy tariff_tiers_admin_delete on public.tariff_tiers
  for delete to authenticated
  using ((select private.is_administrator()));

-- Billing records follow customer assignment. Employees can create and amend
-- only their own draft invoices; administrators can manage every invoice.
create policy invoices_assigned_select on public.invoices
  for select to authenticated
  using ((select private.can_access_customer(customer_id)));
create policy invoices_employee_insert on public.invoices
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.can_access_customer(customer_id))
  );
create policy invoices_employee_update on public.invoices
  for update to authenticated
  using (
    created_by = (select auth.uid())
    and status = 'draft'
    and (select private.can_access_customer(customer_id))
  )
  with check (
    created_by = (select auth.uid())
    and (select private.can_access_customer(customer_id))
  );
create policy invoices_admin_all on public.invoices
  for all to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));

create policy invoice_items_assigned_select on public.invoice_items
  for select to authenticated
  using ((select private.can_access_invoice(invoice_id)));
create policy invoice_items_employee_insert on public.invoice_items
  for insert to authenticated
  with check ((select private.can_manage_invoice(invoice_id)));
create policy invoice_items_employee_update on public.invoice_items
  for update to authenticated
  using ((select private.can_manage_invoice(invoice_id)))
  with check ((select private.can_manage_invoice(invoice_id)));
create policy invoice_items_employee_delete on public.invoice_items
  for delete to authenticated
  using ((select private.can_manage_invoice(invoice_id)));
create policy invoice_items_admin_all on public.invoice_items
  for all to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));

create policy payments_assigned_select on public.payments
  for select to authenticated
  using ((select private.can_access_invoice(invoice_id)));
create policy payments_employee_insert on public.payments
  for insert to authenticated
  with check (
    received_by = (select auth.uid())
    and (select private.can_access_invoice(invoice_id))
    and (select private.is_active_user())
  );
create policy payments_admin_all on public.payments
  for all to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));

create policy printer_devices_owner_select on public.printer_devices
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_active_user()));
create policy printer_devices_owner_insert on public.printer_devices
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_active_user()));
create policy printer_devices_owner_update on public.printer_devices
  for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_active_user()))
  with check (owner_id = (select auth.uid()) and (select private.is_active_user()));
create policy printer_devices_owner_delete on public.printer_devices
  for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_active_user()));
create policy printer_devices_admin_all on public.printer_devices
  for all to authenticated
  using ((select private.is_administrator()))
  with check ((select private.is_administrator()));

-- Audit records are append-only from trusted database/server processes.
create policy audit_logs_admin_select on public.audit_logs
  for select to authenticated
  using ((select private.is_administrator()));

comment on schema private is 'Non-exposed authorization helpers used by NMMPC RLS policies.';
