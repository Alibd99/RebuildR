-- Adds persistent traceability plus rental checkout/return state for the
-- prototype webapp. This keeps the existing materials table intact while
-- layering the rental-specific data and event history on top.

create extension if not exists pgcrypto;

create table if not exists public.material_events (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materials(id) on delete set null,
  container_id bigint references public.containers(id) on delete set null,
  event_type text not null,
  event_status text not null check (event_status in ('info', 'success', 'warning')),
  title text not null,
  description text not null,
  actor_name text,
  material_name text,
  condition_state text,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists material_events_created_at_idx
  on public.material_events(created_at desc);

create index if not exists material_events_material_id_idx
  on public.material_events(material_id);

alter table public.material_events enable row level security;

drop policy if exists "select_material_events_policy" on public.material_events;
drop policy if exists "insert_material_events_policy" on public.material_events;

create policy "select_material_events_policy"
on public.material_events
for select
to public
using (true);

create policy "insert_material_events_policy"
on public.material_events
for insert
to public
with check (true);

grant select, insert on public.material_events to anon, authenticated, service_role;

create table if not exists public.rental_records (
  material_id uuid primary key references public.materials(id) on delete cascade,
  current_holder text,
  rental_status text not null check (rental_status in ('available', 'checked_out', 'inspection_needed')),
  due_at timestamptz,
  checked_out_at timestamptz,
  returned_at timestamptz,
  return_condition text,
  return_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.rental_records (
  material_id,
  current_holder,
  rental_status
)
select
  materials.id,
  case when materials.status = 'Hämtad' then materials.assigned_user else null end,
  case
    when materials.status = 'Hämtad' then 'checked_out'
    when materials.status = 'Kontroll' then 'inspection_needed'
    else 'available'
  end
from public.materials
where materials.type = 'rent'
on conflict (material_id) do nothing;

alter table public.rental_records enable row level security;

drop policy if exists "select_rental_records_policy" on public.rental_records;
drop policy if exists "insert_rental_records_policy" on public.rental_records;
drop policy if exists "update_rental_records_policy" on public.rental_records;

create policy "select_rental_records_policy"
on public.rental_records
for select
to public
using (true);

create policy "insert_rental_records_policy"
on public.rental_records
for insert
to public
with check (true);

create policy "update_rental_records_policy"
on public.rental_records
for update
to public
using (true)
with check (true);

grant select, insert, update on public.rental_records to anon, authenticated, service_role;

create or replace function public.process_material_action(
  p_action text,
  p_material_id uuid,
  p_actor_name text,
  p_due_at timestamptz default null,
  p_return_condition text default null,
  p_return_notes text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_material public.materials%rowtype;
  v_next_status public.material_status;
  v_rental_status text;
  v_title text;
  v_description text;
  v_record public.rental_records%rowtype;
  v_due_at timestamptz := p_due_at;
  v_return_condition text := nullif(trim(coalesce(p_return_condition, '')), '');
  v_return_notes text := nullif(trim(coalesce(p_return_notes, '')), '');
begin
  select *
  into v_material
  from public.materials
  where id = p_material_id;

  if not found then
    raise exception 'Material % not found', p_material_id;
  end if;

  if p_action = 'pickup' then
    v_next_status := 'Hämtad';

    update public.materials
    set status = v_next_status
    where id = p_material_id;

    v_title := 'Upphämtning registrerad';
    v_description := format(
      '%s markerades som hämtad av %s.',
      v_material.name,
      p_actor_name
    );
  elsif p_action = 'rental_checkout' then
    if coalesce(v_material.type::text, '') <> 'rent' then
      raise exception 'Material % is not a rental item', p_material_id;
    end if;

    if v_due_at is null then
      raise exception 'Due date is required for rental checkout';
    end if;

    v_next_status := 'Hämtad';
    v_rental_status := 'checked_out';

    update public.materials
    set status = v_next_status
    where id = p_material_id;

    insert into public.rental_records (
      material_id,
      current_holder,
      rental_status,
      due_at,
      checked_out_at,
      returned_at,
      return_condition,
      return_notes,
      updated_at
    )
    values (
      p_material_id,
      p_actor_name,
      v_rental_status,
      v_due_at,
      timezone('utc', now()),
      null,
      null,
      null,
      timezone('utc', now())
    )
    on conflict (material_id) do update
    set
      current_holder = excluded.current_holder,
      rental_status = excluded.rental_status,
      due_at = excluded.due_at,
      checked_out_at = excluded.checked_out_at,
      returned_at = null,
      return_condition = null,
      return_notes = null,
      updated_at = timezone('utc', now());

    v_title := 'Uthyrning registrerad';
    v_description := format(
      '%s checkades ut av %s med retur %s.',
      v_material.name,
      p_actor_name,
      to_char(v_due_at, 'YYYY-MM-DD')
    );
  elsif p_action = 'rental_return' then
    if coalesce(v_material.type::text, '') <> 'rent' then
      raise exception 'Material % is not a rental item', p_material_id;
    end if;

    if v_return_condition = 'inspection_needed' then
      v_next_status := 'Kontroll';
      v_rental_status := 'inspection_needed';
    else
      v_next_status := 'Uthyrbar';
      v_rental_status := 'available';
      v_return_condition := 'ready';
    end if;

    update public.materials
    set status = v_next_status
    where id = p_material_id;

    insert into public.rental_records (
      material_id,
      current_holder,
      rental_status,
      due_at,
      checked_out_at,
      returned_at,
      return_condition,
      return_notes,
      updated_at
    )
    values (
      p_material_id,
      null,
      v_rental_status,
      null,
      timezone('utc', now()),
      timezone('utc', now()),
      v_return_condition,
      v_return_notes,
      timezone('utc', now())
    )
    on conflict (material_id) do update
    set
      current_holder = null,
      rental_status = excluded.rental_status,
      due_at = null,
      checked_out_at = coalesce(public.rental_records.checked_out_at, excluded.checked_out_at),
      returned_at = excluded.returned_at,
      return_condition = excluded.return_condition,
      return_notes = excluded.return_notes,
      updated_at = timezone('utc', now());

    v_title := case
      when v_rental_status = 'available' then 'Retur registrerad'
      else 'Retur kräver kontroll'
    end;

    v_description := case
      when v_rental_status = 'available' then
        format('%s returnerades av %s och är redo för ny uthyrning.', v_material.name, p_actor_name)
      else
        format('%s returnerades av %s och väntar på kontroll.', v_material.name, p_actor_name)
    end;
  else
    raise exception 'Unknown action %', p_action;
  end if;

  insert into public.material_events (
    material_id,
    container_id,
    event_type,
    event_status,
    title,
    description,
    actor_name,
    material_name,
    condition_state,
    due_at,
    metadata
  )
  values (
    p_material_id,
    v_material.container_id,
    p_action,
    'success',
    v_title,
    v_description,
    p_actor_name,
    v_material.name,
    v_return_condition,
    case when p_action = 'rental_checkout' then v_due_at else null end,
    jsonb_strip_nulls(
      jsonb_build_object(
        'return_notes', v_return_notes
      )
    )
  );

  select *
  into v_record
  from public.rental_records
  where material_id = p_material_id;

  return jsonb_build_object(
    'material_id', p_material_id,
    'material_status', v_next_status,
    'rental_status', v_record.rental_status,
    'current_holder', v_record.current_holder,
    'due_at', v_record.due_at,
    'checked_out_at', v_record.checked_out_at,
    'returned_at', v_record.returned_at,
    'return_condition', v_record.return_condition,
    'return_notes', v_record.return_notes
  );
end;
$$;

grant execute on function public.process_material_action(text, uuid, text, timestamptz, text, text)
to anon, authenticated, service_role;
