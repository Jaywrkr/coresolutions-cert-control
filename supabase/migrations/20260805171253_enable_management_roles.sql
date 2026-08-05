create policy "managers_manage_certification_catalog"
on public.certification_catalog
for all to authenticated
using (
  exists (
    select 1 from public.user_profiles profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
      and profile.role in ('admin', 'brand_manager')
  )
)
with check (
  exists (
    select 1 from public.user_profiles profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
      and profile.role in ('admin', 'brand_manager')
  )
);

create policy "managers_manage_brand_requirements"
on public.brand_requirements
for all to authenticated
using (
  exists (
    select 1 from public.user_profiles profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
      and profile.role in ('admin', 'brand_manager')
  )
)
with check (
  exists (
    select 1 from public.user_profiles profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
      and profile.role in ('admin', 'brand_manager')
  )
);

create policy "managers_manage_technician_certifications"
on public.technician_certifications
for all to authenticated
using (
  exists (
    select 1 from public.user_profiles profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
      and profile.role in ('admin', 'brand_manager')
  )
)
with check (
  exists (
    select 1 from public.user_profiles profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
      and profile.role in ('admin', 'brand_manager')
  )
);
