-- Adds authenticated user profiles with a personal container access code
-- and a dedicated access audit log. This replaces the earlier shared
-- container-code approach with a per-user access model.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null default 'worker' check (role in ('worker', 'manager', 'admin')),
  personal_access_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists personal_access_code text;

create or replace function public.generate_unique_personal_access_code()
returns text
language plpgsql
as $$
declare
  v_code text;
begin
  loop
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');

    exit when not exists (
      select 1
      from public.profiles
      where personal_access_code = v_code
    );
  end loop;

  return v_code;
end;
$$;

alter table public.profiles
  alter column personal_access_code set default public.generate_unique_personal_access_code();

update public.profiles
set personal_access_code = public.generate_unique_personal_access_code()
where nullif(trim(coalesce(personal_access_code, '')), '') is null;

alter table public.profiles
  alter column personal_access_code set not null;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email));

drop index if exists profiles_display_name_unique_idx;

create unique index if not exists profiles_personal_access_code_unique_idx
  on public.profiles (personal_access_code);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at_timestamp();

alter table public.profiles enable row level security;

drop policy if exists "select_own_profile_policy" on public.profiles;
drop policy if exists "insert_own_profile_policy" on public.profiles;
drop policy if exists "update_own_profile_policy" on public.profiles;

create policy "select_own_profile_policy"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "insert_own_profile_policy"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "update_own_profile_policy"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated, service_role;

create table if not exists public.unlock_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  container_id bigint references public.containers(id) on delete set null,
  event_type text not null,
  event_status text not null,
  title text not null,
  description text not null,
  actor_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.unlock_events
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

alter table public.unlock_events
  add column if not exists container_id bigint references public.containers(id) on delete set null;

alter table public.unlock_events
  add column if not exists actor_name text;

alter table public.unlock_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.unlock_events
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.unlock_events
  drop constraint if exists unlock_events_event_type_check;
alter table public.unlock_events
  add constraint unlock_events_event_type_check
  check (
    event_type in (
      'personal_code_created',
      'personal_code_verified',
      'personal_code_failed',
      'container_access_denied'
    )
  );

alter table public.unlock_events
  drop constraint if exists unlock_events_event_status_check;
alter table public.unlock_events
  add constraint unlock_events_event_status_check
  check (event_status in ('info', 'success', 'warning'));

create index if not exists unlock_events_created_at_idx
  on public.unlock_events(created_at desc);

create index if not exists unlock_events_container_id_idx
  on public.unlock_events(container_id);

alter table public.unlock_events enable row level security;

drop policy if exists "select_unlock_events_policy" on public.unlock_events;

create policy "select_unlock_events_policy"
on public.unlock_events
for select
to authenticated
using (true);

grant select on public.unlock_events to authenticated, service_role;

create or replace function public.ensure_profile(p_display_name text default null)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.profiles%rowtype;
  v_email text;
  v_display_name text;
  v_needs_code boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_existing
  from public.profiles
  where id = v_user_id;

  v_email := coalesce(
    auth.jwt() ->> 'email',
    v_existing.email,
    v_user_id::text || '@local.invalid'
  );

  v_display_name := nullif(trim(coalesce(p_display_name, '')), '');

  if v_display_name is null then
    v_display_name := nullif(trim(coalesce(v_existing.display_name, '')), '');
  end if;

  if v_display_name is null then
    v_display_name := nullif(
      trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', '')),
      ''
    );
  end if;

  if v_display_name is null then
    v_display_name := split_part(v_email, '@', 1);
  end if;

  v_needs_code := v_existing.id is null
    or nullif(trim(coalesce(v_existing.personal_access_code, '')), '') is null;

  insert into public.profiles (
    id,
    email,
    display_name,
    role,
    personal_access_code
  )
  values (
    v_user_id,
    v_email,
    left(v_display_name, 80),
    coalesce(v_existing.role, 'worker'),
    coalesce(
      nullif(trim(coalesce(v_existing.personal_access_code, '')), ''),
      public.generate_unique_personal_access_code()
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = case
      when nullif(trim(coalesce(p_display_name, '')), '') is not null then excluded.display_name
      else public.profiles.display_name
    end,
    personal_access_code = coalesce(
      nullif(trim(coalesce(public.profiles.personal_access_code, '')), ''),
      excluded.personal_access_code
    ),
    updated_at = timezone('utc', now())
  returning *
  into v_existing;

  if v_needs_code then
    insert into public.unlock_events (
      user_id,
      event_type,
      event_status,
      title,
      description,
      actor_name,
      metadata
    )
    values (
      v_existing.id,
      'personal_code_created',
      'info',
      'Personlig kod skapad',
      format('%s fick en personlig containerkod.', v_existing.display_name),
      v_existing.display_name,
      jsonb_build_object(
        'email', v_existing.email
      )
    );
  end if;

  return v_existing;
end;
$$;

grant execute on function public.ensure_profile(text) to authenticated, service_role;

create or replace function public.count_container_assignments_for_user(
  p_display_name text,
  p_container_id bigint
)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)
  from public.materials as materials
  join public.containers as containers
    on containers.id = materials.container_id
  left join public.rental_records as rental_records
    on rental_records.material_id = materials.id
  where containers.id = p_container_id
    and containers.mode = 'pickup'
    and lower(coalesce(materials.assigned_user, '')) = lower(coalesce(p_display_name, ''))
    and (
      (materials.type = 'buy' and materials.status = 'Redo')
      or (
        materials.type = 'rent'
        and (
          coalesce(rental_records.rental_status, 'available') = 'available'
          or (
            rental_records.rental_status = 'checked_out'
            and lower(coalesce(rental_records.current_holder, materials.assigned_user, '')) =
                lower(coalesce(p_display_name, ''))
          )
        )
      )
    );
$$;

grant execute on function public.count_container_assignments_for_user(text, bigint) to authenticated, service_role;

create or replace function public.get_container_access_state(p_container_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_assignment_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_profile := public.ensure_profile(null);
  v_assignment_count := public.count_container_assignments_for_user(
    v_profile.display_name,
    p_container_id
  );

  return jsonb_build_object(
    'display_name', v_profile.display_name,
    'personal_access_code', v_profile.personal_access_code,
    'access_granted', v_assignment_count > 0,
    'assignment_count', v_assignment_count
  );
end;
$$;

grant execute on function public.get_container_access_state(bigint) to authenticated, service_role;

drop function if exists public.sync_my_access_grants();
drop function if exists public.expire_stale_unlock_sessions(uuid, text, bigint);
drop function if exists public.get_container_unlock_state(bigint);
drop function if exists public.request_container_unlock_pin(bigint);
drop function if exists public.consume_container_unlock_pin(bigint, text);

create or replace function public.verify_personal_access_code(
  p_container_id bigint,
  p_entered_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_container public.containers%rowtype;
  v_assignment_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_profile := public.ensure_profile(null);

  select *
  into v_container
  from public.containers
  where id = p_container_id;

  if v_container.id is null then
    raise exception 'Container % not found', p_container_id;
  end if;

  v_assignment_count := public.count_container_assignments_for_user(
    v_profile.display_name,
    p_container_id
  );

  if v_assignment_count = 0 then
    insert into public.unlock_events (
      user_id,
      container_id,
      event_type,
      event_status,
      title,
      description,
      actor_name
    )
    values (
      v_profile.id,
      p_container_id,
      'container_access_denied',
      'warning',
      'Åtkomst nekad',
      format(
        '%s saknar aktiv åtkomst till %s.',
        v_profile.display_name,
        v_container.name
      ),
      v_profile.display_name
    );

    return jsonb_build_object(
      'ok', false,
      'reason', 'no_access'
    );
  end if;

  if trim(coalesce(p_entered_code, '')) <> v_profile.personal_access_code then
    insert into public.unlock_events (
      user_id,
      container_id,
      event_type,
      event_status,
      title,
      description,
      actor_name
    )
    values (
      v_profile.id,
      p_container_id,
      'personal_code_failed',
      'warning',
      'Fel personlig kod',
      format(
        '%s angav fel personlig kod för %s.',
        v_profile.display_name,
        v_container.name
      ),
      v_profile.display_name
    );

    return jsonb_build_object(
      'ok', false,
      'reason', 'wrong_code'
    );
  end if;

  insert into public.unlock_events (
    user_id,
    container_id,
    event_type,
    event_status,
    title,
    description,
    actor_name,
    metadata
  )
  values (
    v_profile.id,
    p_container_id,
    'personal_code_verified',
    'success',
    'Container öppnad',
    format(
      '%s öppnade %s med sin personliga kod.',
      v_profile.display_name,
      v_container.name
    ),
    v_profile.display_name,
    jsonb_build_object(
      'assignment_count', v_assignment_count,
      'auth_user_email', v_profile.email
    )
  );

  return jsonb_build_object(
    'ok', true,
    'reason', 'unlocked',
    'assignment_count', v_assignment_count
  );
end;
$$;

grant execute on function public.verify_personal_access_code(bigint, text) to authenticated, service_role;
