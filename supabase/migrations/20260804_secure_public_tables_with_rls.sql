alter table public.brands enable row level security;
alter table public.technicians enable row level security;
alter table public.certification_catalog enable row level security;
alter table public.brand_requirements enable row level security;
alter table public.technician_certifications enable row level security;
alter table public.user_profiles enable row level security;

create policy "authenticated_read_brands"
on public.brands for select to authenticated using (true);

create policy "authenticated_read_technicians"
on public.technicians for select to authenticated using (true);

create policy "authenticated_read_certification_catalog"
on public.certification_catalog for select to authenticated using (true);

create policy "authenticated_read_brand_requirements"
on public.brand_requirements for select to authenticated using (true);

create policy "authenticated_read_technician_certifications"
on public.technician_certifications for select to authenticated using (true);

create policy "users_read_own_profile"
on public.user_profiles for select to authenticated
using (id = auth.uid());

create policy "users_update_own_profile"
on public.user_profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
