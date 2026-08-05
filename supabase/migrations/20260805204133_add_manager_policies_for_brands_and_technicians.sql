create policy "managers_insert_brands"
on public.brands for insert to authenticated
with check ((select private.is_manager()));

create policy "managers_update_brands"
on public.brands for update to authenticated
using ((select private.is_manager()))
with check ((select private.is_manager()));

create policy "managers_delete_brands"
on public.brands for delete to authenticated
using ((select private.is_manager()));

create policy "managers_insert_technicians"
on public.technicians for insert to authenticated
with check ((select private.is_manager()));

create policy "managers_update_technicians"
on public.technicians for update to authenticated
using ((select private.is_manager()))
with check ((select private.is_manager()));

create policy "managers_delete_technicians"
on public.technicians for delete to authenticated
using ((select private.is_manager()));
