do $$
declare
  dashboard_table text;
begin
  foreach dashboard_table in array array[
    'brands',
    'technicians',
    'certification_catalog',
    'brand_requirements',
    'technician_certifications'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = dashboard_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', dashboard_table);
    end if;
  end loop;
end $$;
