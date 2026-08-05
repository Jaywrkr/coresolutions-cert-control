alter table public.brands
  add column if not exists sort_order integer not null default 0;

with ranked_brands as (
  select id, row_number() over (order by name, id)::integer as position
  from public.brands
)
update public.brands
set sort_order = ranked_brands.position
from ranked_brands
where brands.id = ranked_brands.id;

create index if not exists brands_sort_order_idx
  on public.brands (sort_order, name);
