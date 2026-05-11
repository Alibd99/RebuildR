-- Lets a valid personal code unlock the selected pickup container even when the
-- user has zero active assignments there. Assignment count is still returned and
-- logged for traceability, but it is no longer treated as a hard access gate.

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
        'auth_user_email', v_profile.email
      )
    );

    return jsonb_build_object(
      'ok', false,
      'reason', 'transport_locked'
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
        '%s angav fel personlig kod för %s.',
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
