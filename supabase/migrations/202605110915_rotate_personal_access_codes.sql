-- Replaces the static personal code with a rotating minute-based code that is
-- derived from each user's stored personal access seed. The same user gets the
-- same active code across all pickup containers, but the code refreshes every
-- minute for better security.

create extension if not exists pgcrypto;

create or replace function public.compute_rotating_personal_access_code(
  p_seed text,
  p_reference timestamptz default timezone('utc', now())
)
returns text
language sql
stable
as $$
  with hashed as (
    select extensions.digest(
      convert_to(
        coalesce(p_seed, '') || ':' ||
        floor(extract(epoch from date_trunc('minute', p_reference)) / 60)::bigint::text,
        'UTF8'
      ),
      'sha256'
    ) as hash_bytes
  )
  select lpad(
    (
      (
        (get_byte(hash_bytes, 0)::bigint << 24) +
        (get_byte(hash_bytes, 1)::bigint << 16) +
        (get_byte(hash_bytes, 2)::bigint << 8) +
        get_byte(hash_bytes, 3)::bigint
      ) % 1000000
    )::text,
    6,
    '0'
  )
  from hashed;
$$;

grant execute on function public.compute_rotating_personal_access_code(text, timestamptz)
to authenticated, service_role;

create or replace function public.get_container_access_state(p_container_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_assignment_count integer := 0;
  v_now timestamptz := timezone('utc', now());
  v_code_expires_at timestamptz := date_trunc('minute', v_now) + interval '1 minute';
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
    'personal_access_code', public.compute_rotating_personal_access_code(
      v_profile.personal_access_code,
      v_now
    ),
    'code_expires_at', v_code_expires_at,
    'access_granted', true,
    'assignment_count', v_assignment_count
  );
end;
$$;

grant execute on function public.get_container_access_state(bigint) to authenticated, service_role;

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
  v_now timestamptz := timezone('utc', now());
  v_code_expires_at timestamptz := date_trunc('minute', v_now) + interval '1 minute';
  v_current_code text;
  v_previous_code text;
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

  v_current_code := public.compute_rotating_personal_access_code(
    v_profile.personal_access_code,
    v_now
  );
  v_previous_code := public.compute_rotating_personal_access_code(
    v_profile.personal_access_code,
    v_now - interval '1 minute'
  );

  if coalesce(v_container.mode, 'pickup') <> 'pickup' then
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
      'container_access_denied',
      'warning',
      'Åtkomst nekad',
      format(
        '%s försökte öppna %s medan containern var i transportläge.',
        v_profile.display_name,
        v_container.name
      ),
      v_profile.display_name,
      jsonb_build_object(
        'container_mode', v_container.mode,
        'assignment_count', v_assignment_count,
        'auth_user_email', v_profile.email,
        'code_expires_at', v_code_expires_at,
        'code_strategy', 'rotating_per_user'
      )
    );

    return jsonb_build_object(
      'ok', false,
      'reason', 'transport_locked'
    );
  end if;

  if trim(coalesce(p_entered_code, '')) not in (v_current_code, v_previous_code) then
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
      'personal_code_failed',
      'warning',
      'Fel personlig kod',
      format(
        '%s angav fel eller utgången personlig kod för %s.',
        v_profile.display_name,
        v_container.name
      ),
      v_profile.display_name,
      jsonb_build_object(
        'assignment_count', v_assignment_count,
        'auth_user_email', v_profile.email,
        'code_expires_at', v_code_expires_at,
        'code_strategy', 'rotating_per_user'
      )
    );

    return jsonb_build_object(
      'ok', false,
      'reason', 'wrong_code',
      'code_expires_at', v_code_expires_at
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
      '%s öppnade %s med sin roterande personliga kod.',
      v_profile.display_name,
      v_container.name
    ),
    v_profile.display_name,
    jsonb_build_object(
      'assignment_count', v_assignment_count,
      'auth_user_email', v_profile.email,
      'code_expires_at', v_code_expires_at,
      'code_strategy', 'rotating_per_user'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'reason', 'unlocked',
    'assignment_count', v_assignment_count,
    'code_expires_at', v_code_expires_at
  );
end;
$$;

grant execute on function public.verify_personal_access_code(bigint, text) to authenticated, service_role;
