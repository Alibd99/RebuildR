-- Allows the prototype app to save material status changes, for example when
-- a worker confirms that an item has been picked up from the container.
--
-- This is suitable for the current prototype. Before production, this should
-- be replaced with stricter policies based on authenticated users and roles.

alter table public.materials enable row level security;

drop policy if exists "update_materials_policy" on public.materials;

create policy "update_materials_policy"
on public.materials
for update
to public
using (true)
with check (true);
