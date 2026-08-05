create schema if not exists private;

create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.user_profiles
    where id = (select auth.uid())
      and status = 'active'
      and role in ('admin', 'brand_manager')
  );
$$;

revoke all on function private.is_manager() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_manager() to authenticated;

drop policy "admins_can_read_all_profiles" on public.user_profiles;
drop policy "admins_can_update_profiles" on public.user_profiles;
drop policy "users_update_own_profile" on public.user_profiles;

create policy "managers_can_read_profiles" on public.user_profiles
for select to authenticated using ((select private.is_manager()));

create policy "managers_can_update_profiles" on public.user_profiles
for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));

drop policy "managers_insert_certification_catalog" on public.certification_catalog;
drop policy "managers_update_certification_catalog" on public.certification_catalog;
drop policy "managers_delete_certification_catalog" on public.certification_catalog;
drop policy "managers_insert_brand_requirements" on public.brand_requirements;
drop policy "managers_update_brand_requirements" on public.brand_requirements;
drop policy "managers_delete_brand_requirements" on public.brand_requirements;
drop policy "managers_insert_technician_certifications" on public.technician_certifications;
drop policy "managers_update_technician_certifications" on public.technician_certifications;
drop policy "managers_delete_technician_certifications" on public.technician_certifications;

create policy "managers_insert_certification_catalog" on public.certification_catalog for insert to authenticated with check ((select private.is_manager()));
create policy "managers_update_certification_catalog" on public.certification_catalog for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));
create policy "managers_delete_certification_catalog" on public.certification_catalog for delete to authenticated using ((select private.is_manager()));
create policy "managers_insert_brand_requirements" on public.brand_requirements for insert to authenticated with check ((select private.is_manager()));
create policy "managers_update_brand_requirements" on public.brand_requirements for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));
create policy "managers_delete_brand_requirements" on public.brand_requirements for delete to authenticated using ((select private.is_manager()));
create policy "managers_insert_technician_certifications" on public.technician_certifications for insert to authenticated with check ((select private.is_manager()));
create policy "managers_update_technician_certifications" on public.technician_certifications for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));
create policy "managers_delete_technician_certifications" on public.technician_certifications for delete to authenticated using ((select private.is_manager()));
