-- Controlled invoice printing and append-only reprint audit records.

create or replace function public.begin_invoice_print(
  p_invoice_id uuid,
  p_is_reprint boolean default false,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  print_log_id bigint;
  has_successful_print boolean;
begin
  if (select auth.uid()) is null or not (select private.can_access_invoice(p_invoice_id)) then
    raise exception 'Invoice is unavailable' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.audit_logs
    where entity_type = 'invoice' and entity_id = p_invoice_id
      and action in ('invoice_print_succeeded', 'invoice_reprint_succeeded')
  ) into has_successful_print;

  if has_successful_print and not p_is_reprint then
    raise exception 'Invoice was already printed; submit a controlled reprint with a reason' using errcode = '23505';
  end if;
  if p_is_reprint and not has_successful_print then
    raise exception 'Cannot reprint an invoice that has no successful original print' using errcode = '23514';
  end if;
  if p_is_reprint and nullif(btrim(p_reason), '') is null then
    raise exception 'A reprint reason is required' using errcode = '23514';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    case when p_is_reprint then 'invoice_reprint_attempted' else 'invoice_print_attempted' end,
    'invoice',
    p_invoice_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('reason', nullif(btrim(p_reason), ''))
  )
  returning id into print_log_id;

  return print_log_id;
end;
$$;

create or replace function public.complete_invoice_print(
  p_invoice_id uuid,
  p_attempt_id bigint,
  p_succeeded boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_action text;
begin
  select action into attempt_action
  from public.audit_logs
  where id = p_attempt_id and entity_type = 'invoice' and entity_id = p_invoice_id
    and actor_id = (select auth.uid())
    and action in ('invoice_print_attempted', 'invoice_reprint_attempted');

  if attempt_action is null then
    raise exception 'Print attempt is unavailable' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    case
      when attempt_action = 'invoice_reprint_attempted' and p_succeeded then 'invoice_reprint_succeeded'
      when attempt_action = 'invoice_reprint_attempted' then 'invoice_reprint_failed'
      when p_succeeded then 'invoice_print_succeeded'
      else 'invoice_print_failed'
    end,
    'invoice',
    p_invoice_id,
    jsonb_build_object('attempt_id', p_attempt_id, 'error', nullif(p_error, ''))
  );
end;
$$;

revoke all on function public.begin_invoice_print(uuid, boolean, text, jsonb) from public, anon;
revoke all on function public.complete_invoice_print(uuid, bigint, boolean, text) from public, anon;
grant execute on function public.begin_invoice_print(uuid, boolean, text, jsonb) to authenticated;
grant execute on function public.complete_invoice_print(uuid, bigint, boolean, text) to authenticated;

comment on function public.begin_invoice_print is 'Authorizes one original print or a reason-controlled reprint and records the attempt.';
comment on function public.complete_invoice_print is 'Appends the success or failure result for an authorized invoice print attempt.';
