-- Private meter-photo evidence for Phase 6.
-- Object paths are immutable: <employee_id>/<customer_id>/<photo_id>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meter-photos', 'meter-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy meter_photos_employee_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meter-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and case
      when coalesce((storage.foldername(name))[2], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (select private.can_access_customer(((storage.foldername(name))[2])::uuid))
      else false
    end
  );

create policy meter_photos_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meter-photos'
    and owner_id = (select auth.uid())::text
    and (select private.is_active_user())
  );

create policy meter_photos_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'meter-photos' and (select private.is_administrator()));

comment on column public.meter_readings.photo_path is
  'Immutable private Storage object path for the original meter photograph.';
