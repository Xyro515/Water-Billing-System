-- Generate a unique, human-readable reference when a collection does not
-- provide an external bank, wallet, or check reference.

create sequence if not exists public.payment_reference_number_seq;

do $$
declare
  next_reference_number bigint;
  payment_row record;
begin
  select coalesce(max(substring(reference_number from '^NMMPC-PAY-[0-9]{8}-([0-9]{8})$')::bigint), 0) + 1
    into next_reference_number
  from public.payments;

  perform setval('public.payment_reference_number_seq', greatest(next_reference_number, 1), false);

  for payment_row in
    select id, paid_at
    from public.payments
    where nullif(btrim(reference_number), '') is null
    order by paid_at, id
  loop
    update public.payments
    set reference_number = format(
      'NMMPC-PAY-%s-%s',
      to_char(payment_row.paid_at at time zone 'Asia/Manila', 'YYYYMMDD'),
      lpad(nextval('public.payment_reference_number_seq')::text, 8, '0')
    )
    where id = payment_row.id;
  end loop;
end;
$$;

revoke all on sequence public.payment_reference_number_seq from public, anon, authenticated;

create or replace function public.record_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_reference_number text default null,
  p_notes text default null,
  p_client_operation_id uuid default gen_random_uuid()
) returns public.payments
language plpgsql security definer set search_path = '' as $$
declare
  created_payment public.payments%rowtype;
  invoice_row record;
  remaining numeric(12,2) := round(p_amount, 2);
  total_balance numeric(12,2);
  allocation_amount numeric(12,2);
  first_invoice_id uuid;
  payment_reference text;
begin
  if not (select private.is_active_user()) or not (select private.can_access_customer(p_customer_id)) then
    raise exception 'Customer payment access denied' using errcode = '42501';
  end if;
  if remaining <= 0 then raise exception 'Payment amount must be greater than zero' using errcode = '23514'; end if;

  select * into created_payment from public.payments where client_operation_id = p_client_operation_id;
  if found then return created_payment; end if;

  perform 1 from public.invoices where customer_id = p_customer_id and archived_at is null for update;
  select coalesce(sum(balance), 0), (array_agg(id order by due_date, billing_period_end, created_at))[1]
    into total_balance, first_invoice_id
  from public.invoice_balances
  where customer_id = p_customer_id and archived_at is null
    and status not in ('draft', 'paid', 'void') and balance > 0;

  if total_balance <= 0 then raise exception 'Customer has no payable balance' using errcode = '23514'; end if;
  if remaining > total_balance then raise exception 'Payment exceeds outstanding balance of %', total_balance using errcode = '23514'; end if;

  payment_reference := coalesce(
    nullif(btrim(p_reference_number), ''),
    format(
      'NMMPC-PAY-%s-%s',
      to_char(current_timestamp at time zone 'Asia/Manila', 'YYYYMMDD'),
      lpad(nextval('public.payment_reference_number_seq')::text, 8, '0')
    )
  );

  insert into public.payments (invoice_id, customer_id, amount, method, reference_number, status, received_by, client_operation_id, notes)
  values (first_invoice_id, p_customer_id, remaining, p_method, payment_reference, 'completed', (select auth.uid()), p_client_operation_id, nullif(btrim(p_notes), ''))
  returning * into created_payment;

  for invoice_row in
    select id, balance, due_date from public.invoice_balances
    where customer_id = p_customer_id and archived_at is null
      and status not in ('draft', 'paid', 'void') and balance > 0
    order by due_date, billing_period_end, created_at
  loop
    exit when remaining <= 0;
    allocation_amount := least(remaining, invoice_row.balance);
    insert into public.payment_allocations (payment_id, invoice_id, amount)
    values (created_payment.id, invoice_row.id, allocation_amount);
    remaining := remaining - allocation_amount;
    update public.invoices set
      status = case when allocation_amount >= invoice_row.balance then 'paid'::public.invoice_status
                    when invoice_row.due_date < current_date then 'overdue'::public.invoice_status
                    else 'partially_paid'::public.invoice_status end,
      finalized_at = coalesce(finalized_at, now())
    where id = invoice_row.id;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'payment.allocated', 'payment', created_payment.id,
    jsonb_build_object('customer_id', p_customer_id, 'amount', p_amount, 'reference_number', payment_reference, 'allocation_policy', 'oldest_due_first'));
  return created_payment;
end;
$$;

revoke all on function public.record_customer_payment(uuid, numeric, public.payment_method, text, text, uuid) from public, anon;
grant execute on function public.record_customer_payment(uuid, numeric, public.payment_method, text, text, uuid) to authenticated;

comment on sequence public.payment_reference_number_seq is 'Monotonic suffix for automatically generated NMMPC payment references.';
