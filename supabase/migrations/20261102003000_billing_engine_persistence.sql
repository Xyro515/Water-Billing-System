-- Atomic, idempotent invoice persistence and finalized-invoice auditing.

create sequence if not exists public.invoice_number_sequence;
grant usage, select on sequence public.invoice_number_sequence to authenticated;

create unique index if not exists invoices_customer_period_unique_idx
  on public.invoices (customer_id, billing_period_start, billing_period_end)
  where archived_at is null and status <> 'void';

create or replace function public.create_invoice_atomic(
  p_customer_id uuid,
  p_meter_reading_id uuid,
  p_tariff_id uuid,
  p_billing_period_start date,
  p_billing_period_end date,
  p_due_date date,
  p_subtotal numeric,
  p_fixed_charges numeric,
  p_discounts numeric,
  p_taxes numeric,
  p_penalties numeric,
  p_previous_balance numeric,
  p_total_amount numeric,
  p_tariff_snapshot jsonb,
  p_client_operation_id uuid,
  p_items jsonb
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_invoice public.invoices%rowtype;
  created_invoice public.invoices%rowtype;
  generated_number text;
begin
  select * into existing_invoice from public.invoices where client_operation_id = p_client_operation_id;
  if found then return existing_invoice; end if;

  if not (select private.can_access_customer(p_customer_id)) then
    raise exception 'Customer access denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.meter_readings
    where id = p_meter_reading_id and customer_id = p_customer_id
  ) then raise exception 'Meter reading does not belong to the customer' using errcode = '23503'; end if;
  if not exists (
    select 1 from public.tariffs
    where id = p_tariff_id and is_approved and archived_at is null
      and effective_from <= p_billing_period_end
      and (effective_to is null or effective_to >= p_billing_period_end)
  ) then raise exception 'No approved effective tariff was supplied' using errcode = '23514'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one invoice item is required' using errcode = '23514';
  end if;

  generated_number := 'NMMPC-' || to_char(current_date, 'YYYYMM') || '-' || lpad(nextval('public.invoice_number_sequence')::text, 8, '0');
  insert into public.invoices (
    invoice_number, customer_id, meter_reading_id, tariff_id,
    billing_period_start, billing_period_end, due_date,
    subtotal, fixed_charges, discounts, taxes, penalties, previous_balance,
    total_amount, tariff_snapshot, created_by, client_operation_id
  ) values (
    generated_number, p_customer_id, p_meter_reading_id, p_tariff_id,
    p_billing_period_start, p_billing_period_end, p_due_date,
    p_subtotal, p_fixed_charges, p_discounts, p_taxes, p_penalties, p_previous_balance,
    p_total_amount, p_tariff_snapshot, (select auth.uid()), p_client_operation_id
  ) returning * into created_invoice;

  insert into public.invoice_items (invoice_id, item_type, description, quantity, unit_price, amount, sort_order, calculation_snapshot)
  select created_invoice.id, item.item_type, item.description, item.quantity, item.unit_price,
         item.amount, item.sort_order, coalesce(item.calculation_snapshot, '{}'::jsonb)
  from jsonb_to_recordset(p_items) as item(
    item_type text, description text, quantity numeric, unit_price numeric,
    amount numeric, sort_order integer, calculation_snapshot jsonb
  );
  return created_invoice;
exception
  when unique_violation then
    select * into existing_invoice from public.invoices where client_operation_id = p_client_operation_id;
    if found then return existing_invoice; end if;
    raise;
end;
$$;

revoke all on function public.create_invoice_atomic(uuid,uuid,uuid,date,date,date,numeric,numeric,numeric,numeric,numeric,numeric,numeric,jsonb,uuid,jsonb) from public, anon;
grant execute on function public.create_invoice_atomic(uuid,uuid,uuid,date,date,date,numeric,numeric,numeric,numeric,numeric,numeric,numeric,jsonb,uuid,jsonb) to authenticated;

create or replace function public.audit_finalized_invoice_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Finalized invoices cannot be deleted; void them with an audit reason';
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, metadata)
  values ((select auth.uid()), 'finalized_invoice_updated', 'invoice', old.id, to_jsonb(old), to_jsonb(new), jsonb_build_object('source', 'database_trigger'));
  return new;
end;
$$;

create trigger invoices_audit_finalized_change
  before update or delete on public.invoices
  for each row when (old.status <> 'draft')
  execute function public.audit_finalized_invoice_change();

comment on function public.create_invoice_atomic is 'Creates one draft invoice and its detailed items atomically; client_operation_id makes retries idempotent.';

