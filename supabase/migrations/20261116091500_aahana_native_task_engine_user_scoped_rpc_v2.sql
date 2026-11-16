-- Keep task-engine RPCs bound to the authenticated owner session.
-- No service-role key is required by the execution endpoint.
drop function if exists public.aahana_claim_approved_task(uuid, uuid);
drop function if exists public.aahana_complete_approved_task(uuid, uuid, jsonb);
drop function if exists public.aahana_block_failed_task(uuid, uuid, text);

create function public.aahana_claim_approved_task(p_task_id uuid)
returns public.aahana_ops_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.aahana_ops_tasks;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  update public.aahana_ops_tasks
  set status = 'in_progress',
      execution_attempts = execution_attempts + 1,
      execution_started_at = now(),
      execution_completed_at = null,
      execution_error = null,
      updated_at = now()
  where id = p_task_id
    and user_id = v_user_id
    and status = 'approved'
    and approval_required = true
    and approved_at is not null
    and execution_attempts < 3
  returning * into v_task;

  if not found then
    raise exception 'Task is unavailable, not approved, or has reached its execution limit'
      using errcode = '22023';
  end if;

  return v_task;
end;
$$;

create function public.aahana_complete_approved_task(p_task_id uuid, p_result jsonb)
returns public.aahana_ops_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.aahana_ops_tasks;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' or pg_column_size(p_result) > 32768 then
    raise exception 'Invalid execution result' using errcode = '22023';
  end if;

  update public.aahana_ops_tasks
  set status = 'completed',
      execution_result = p_result,
      execution_completed_at = now(),
      execution_error = null,
      completed_at = now(),
      updated_at = now()
  where id = p_task_id
    and user_id = v_user_id
    and status = 'in_progress'
  returning * into v_task;

  if not found then
    raise exception 'Task is not currently running or does not belong to this user' using errcode = '22023';
  end if;

  return v_task;
end;
$$;

create function public.aahana_block_failed_task(p_task_id uuid, p_error text)
returns public.aahana_ops_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.aahana_ops_tasks;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  update public.aahana_ops_tasks
  set status = 'blocked',
      execution_completed_at = now(),
      execution_error = left(coalesce(nullif(trim(p_error), ''), 'Execution failed.'), 500),
      updated_at = now()
  where id = p_task_id
    and user_id = v_user_id
    and status = 'in_progress'
  returning * into v_task;

  if not found then
    raise exception 'Task is not currently running or does not belong to this user' using errcode = '22023';
  end if;

  return v_task;
end;
$$;

revoke all on function public.aahana_claim_approved_task(uuid) from public, anon;
revoke all on function public.aahana_complete_approved_task(uuid, jsonb) from public, anon;
revoke all on function public.aahana_block_failed_task(uuid, text) from public, anon;
grant execute on function public.aahana_claim_approved_task(uuid) to authenticated;
grant execute on function public.aahana_complete_approved_task(uuid, jsonb) to authenticated;
grant execute on function public.aahana_block_failed_task(uuid, text) to authenticated;
