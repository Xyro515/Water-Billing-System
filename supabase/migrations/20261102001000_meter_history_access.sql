-- Employees may view historical meters for assigned customers, while
-- private.can_access_meter remains active-assignment-only for reading writes.
create or replace function private.can_view_meter(target_meter_id uuid)
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
      and customer.assigned_employee_id = (select auth.uid())
      and customer.archived_at is null
      and (select private.is_active_user())
  );
$$;

revoke all on function private.can_view_meter(uuid) from public, anon;
grant execute on function private.can_view_meter(uuid) to authenticated;

drop policy meters_assigned_select on public.meters;
create policy meters_assigned_select on public.meters
  for select to authenticated
  using ((select private.can_view_meter(id)));

