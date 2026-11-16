-- Native Aahana task execution v1.
-- Only service_role can claim/finalise work. User approval is still required.
alter table public.aahana_ops_tasks
  add column if not exists execution_attempts integer not null default 0
    check (execution_attempts between 0 and 3),
  add column if not exists execution_result jsonb
    check (execution_result is null or (jsonb_typeof(execution_result) = 'object' and pg_column_size(execution_result) <= 32768)),
  add column if not exists execution_started_at timestamptz,
  add column if not exists execution_completed_at timestamptz,
  add column if not exists execution_error text
    check (execution_error is null or char_length(execution_error) <= 500);

create or replace function public.aahana_claim_approved_task(
  p_task_id uuid,
  p_user_id uuid
)
returns public.aahana_ops_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.aahana_ops_tasks;
begin
  if p_task_id is null or p_user_id is null then
    raise exception 'Task and owner are required' using errcode = '22023';
  end if;

  update public.aahana_ops_tasks
  set status = 'in_progress',
      execution_attempts = execution_attempts + 1,
      execution_started_at = now(),
      execution_completed_at = null,
      execution_error = null,
      updated_at = now()
  where id = p_task_id
    and user_id = p_user_id
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

create or replace function public.aahana_complete_approved_task(
  p_task_id uuid,
  p_user_id uuid,
  p_result jsonb
)
returns public.aahana_ops_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.aahana_ops_tasks;
begin
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
    and user_id = p_user_id
    and status = 'in_progress'
  returning * into v_task;

  if not found then
    raise exception 'Task is not currently running' using errcode = '22023';
  end if;

  return v_task;
end;
$$;

create or replace function public.aahana_block_failed_task(
  p_task_id uuid,
  p_user_id uuid,
  p_error text
)
returns public.aahana_ops_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.aahana_ops_tasks;
begin
  update public.aahana_ops_tasks
  set status = 'blocked',
      execution_completed_at = now(),
      execution_error = left(coalesce(nullif(trim(p_error), ''), 'Execution failed.'), 500),
      updated_at = now()
  where id = p_task_id
    and user_id = p_user_id
    and status = 'in_progress'
  returning * into v_task;

  if not found then
    raise exception 'Task is not currently running' using errcode = '22023';
  end if;

  return v_task;
end;
$$;

revoke all on function public.aahana_claim_approved_task(uuid, uuid) from public, anon, authenticated;
revoke all on function public.aahana_complete_approved_task(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.aahana_block_failed_task(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.aahana_claim_approved_task(uuid, uuid) to service_role;
grant execute on function public.aahana_complete_approved_task(uuid, uuid, jsonb) to service_role;
grant execute on function public.aahana_block_failed_task(uuid, uuid, text) to service_role;
