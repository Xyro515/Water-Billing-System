-- Arrears are derived from unpaid invoice balances. They are never duplicated as new debt.

alter table public.invoices add column current_amount numeric(12, 2);
update public.invoices set current_amount = greatest(0, total_amount - previous_balance);
alter table public.invoices alter column current_amount set not null;
alter table public.invoices alter column current_amount set default 0;
alter table public.invoices add constraint invoices_current_amount_nonnegative check (current_amount >= 0);

create or replace function public.set_invoice_current_amount()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.current_amount := greatest(0, new.total_amount - new.previous_balance);
  return new;
end;
$$;
create trigger invoices_set_current_amount
  before insert or update of total_amount, previous_balance on public.invoices
  for each row execute function public.set_invoice_current_amount();

alter table public.payments add column customer_id uuid references public.customers (id) on delete restrict;
update public.payments payment set customer_id = invoice.customer_id from public.invoices invoice where invoice.id = payment.invoice_id;
alter table public.payments alter column customer_id set not null;
alter table public.payments alter column invoice_id drop not null;
create index payments_customer_date_idx on public.payments (customer_id, paid_at desc);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint payment_allocations_payment_invoice_unique unique (payment_id, invoice_id)
);
create index payment_allocations_invoice_idx on public.payment_allocations (invoice_id);

insert into public.payment_allocations (payment_id, invoice_id, amount)
select id, invoice_id, amount from public.payments
where status = 'completed' and invoice_id is not null
on conflict (payment_id, invoice_id) do nothing;

alter table public.payment_allocations enable row level security;
create policy payment_allocations_assigned_select on public.payment_allocations
  for select to authenticated using ((select private.can_access_invoice(invoice_id)));
create policy payment_allocations_admin_select on public.payment_allocations
  for select to authenticated using ((select private.is_administrator()));

create or replace view public.invoice_balances with (security_invoker = true) as
select invoice.*,
  coalesce(sum(allocation.amount) filter (where payment.status = 'completed'), 0)::numeric(12,2) as allocated_amount,
  greatest(invoice.current_amount - coalesce(sum(allocation.amount) filter (where payment.status = 'completed'), 0), 0)::numeric(12,2) as balance
from public.invoices invoice
left join public.payment_allocations allocation on allocation.invoice_id = invoice.id
left join public.payments payment on payment.id = allocation.payment_id
group by invoice.id;

grant select on public.invoice_balances to authenticated;
grant select on public.payment_allocations to authenticated;

create or replace function public.get_customer_arrears(p_customer_id uuid, p_before_date date default null)
returns table (previous_arrears numeric, oldest_due_date date, open_invoice_count bigint)
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(balance), 0)::numeric(12,2), min(due_date), count(*)
  from public.invoice_balances
  where customer_id = p_customer_id
    and archived_at is null and status not in ('draft', 'paid', 'void') and balance > 0
    and (p_before_date is null or billing_period_end < p_before_date);
$$;

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

  insert into public.payments (invoice_id, customer_id, amount, method, reference_number, status, received_by, client_operation_id, notes)
  values (first_invoice_id, p_customer_id, remaining, p_method, nullif(btrim(p_reference_number), ''), 'completed', (select auth.uid()), p_client_operation_id, nullif(btrim(p_notes), ''))
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
    jsonb_build_object('customer_id', p_customer_id, 'amount', p_amount, 'allocation_policy', 'oldest_due_first'));
  return created_payment;
end;
$$;

revoke all on function public.get_customer_arrears(uuid, date) from public, anon;
grant execute on function public.get_customer_arrears(uuid, date) to authenticated;
revoke all on function public.record_customer_payment(uuid, numeric, public.payment_method, text, text, uuid) from public, anon;
grant execute on function public.record_customer_payment(uuid, numeric, public.payment_method, text, text, uuid) to authenticated;

comment on table public.payment_allocations is 'Immutable oldest-first allocation of completed payments to monthly invoices.';
comment on column public.invoices.current_amount is 'Original charge created by this billing period, excluding displayed prior arrears.';
