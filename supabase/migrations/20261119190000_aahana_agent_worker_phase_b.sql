-- Aahana autonomous worker Phase B.
-- Service-role-only task leases, checkpoints, retry handling and immutable events.
alter table public.aahana_agent_tasks
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists checkpoint jsonb not null default '{}'::jsonb
    check (jsonb_typeof(checkpoint) = 'object' and pg_column_size(checkpoint) <= 8192);

create index if not exists aahana_agent_tasks_lease_idx
  on public.aahana_agent_tasks (status, lease_expires_at, priority desc);

create table if not exists public.aahana_agent_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.aahana_agent_tasks(id) on delete cascade,
  run_id uuid not null references public.aahana_agent_runs(id) on delete cascade,
  event_type text not null check (event_type in (
    'task_claimed', 'checkpoint_saved', 'task_heartbeat',
    'task_retried', 'task_completed', 'task_blocked', 'lease_expired'
  )),
  attempt integer not null check (attempt between 0 and 5),
  summary text not null check (char_length(summary) between 1 and 240),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096),
  created_at timestamptz not null default now()
);
create index if not exists aahana_agent_task_events_task_idx
  on public.aahana_agent_task_events (task_id, created_at asc);
create index if not exists aahana_agent_task_events_run_idx
  on public.aahana_agent_task_events (run_id, created_at asc);

alter table public.aahana_agent_task_events enable row level security;
revoke all on public.aahana_agent_task_events from anon, authenticated;
grant select, insert on public.aahana_agent_task_events to service_role;

create or replace function public.aahana_claim_next_agent_task(p_lease_seconds integer default 180)
returns public.aahana_agent_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.aahana_agent_tasks;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception 'Lease duration is outside the permitted range' using errcode = '22023';
  end if;

  insert into public.aahana_agent_task_events (task_id, run_id, event_type, attempt, summary, metadata)
  select id, run_id, 'lease_expired', attempts,
    'Task lease expired after reaching the retry limit.',
    jsonb_build_object('reason', 'attempt_limit_reached')
  from public.aahana_agent_tasks
  where status = 'claimed' and lease_expires_at <= now() and attempts >= 5;

  update public.aahana_agent_tasks
  set status = 'blocked', finished_at = now(), lease_token = null,
      lease_expires_at = null, error_code = 'lease_expired_attempt_limit',
      updated_at = now()
  where status = 'claimed' and lease_expires_at <= now() and attempts >= 5;

  select * into v_task
  from public.aahana_agent_tasks
  where attempts < 5
    and available_at <= now()
    and (
      status = 'queued'
      or (status = 'claimed' and lease_expires_at <= now())
    )
  order by priority desc, available_at asc, created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.aahana_agent_tasks
  set status = 'claimed',
      attempts = attempts + 1,
      claimed_at = now(),
      heartbeat_at = now(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      lease_token = gen_random_uuid(),
      error_code = null,
      updated_at = now()
  where id = v_task.id
  returning * into v_task;

  insert into public.aahana_agent_task_events (task_id, run_id, event_type, attempt, summary, metadata)
  values (v_task.id, v_task.run_id, 'task_claimed', v_task.attempts,
    'Worker claimed the task with a time-limited lease.',
    jsonb_build_object('lease_seconds', p_lease_seconds));

  return v_task;
end;
$$;

create or replace function public.aahana_heartbeat_agent_task(
  p_task_id uuid,
  p_lease_token uuid,
  p_checkpoint jsonb default '{}'::jsonb,
  p_lease_seconds integer default 180
)
returns public.aahana_agent_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.aahana_agent_tasks;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 300
    or p_checkpoint is null
    or jsonb_typeof(p_checkpoint) <> 'object'
    or pg_column_size(p_checkpoint) > 8192 then
    raise exception 'Invalid heartbeat payload' using errcode = '22023';
  end if;

  update public.aahana_agent_tasks
  set heartbeat_at = now(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      checkpoint = p_checkpoint,
      updated_at = now()
  where id = p_task_id and status = 'claimed'
    and lease_token = p_lease_token and lease_expires_at > now()
  returning * into v_task;

  if not found then
    raise exception 'Task lease is no longer valid' using errcode = '22023';
  end if;

  insert into public.aahana_agent_task_events (task_id, run_id, event_type, attempt, summary, metadata)
  values (v_task.id, v_task.run_id, 'checkpoint_saved', v_task.attempts,
    'Worker heartbeat and checkpoint saved.',
    jsonb_build_object('checkpoint_keys', (select coalesce(jsonb_agg(key), '[]'::jsonb) from jsonb_object_keys(p_checkpoint) as key)));

  return v_task;
end;
$$;

create or replace function public.aahana_complete_agent_task(
  p_task_id uuid,
  p_lease_token uuid,
  p_result jsonb
)
returns public.aahana_agent_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.aahana_agent_tasks;
begin
  if p_result is null or jsonb_typeof(p_result) <> 'object' or pg_column_size(p_result) > 16384 then
    raise exception 'Invalid task result' using errcode = '22023';
  end if;

  update public.aahana_agent_tasks
  set status = 'completed', result = p_result, finished_at = now(),
      lease_token = null, lease_expires_at = null, heartbeat_at = now(),
      error_code = null, updated_at = now()
  where id = p_task_id and status = 'claimed'
    and lease_token = p_lease_token and lease_expires_at > now()
  returning * into v_task;

  if not found then
    raise exception 'Task lease is no longer valid' using errcode = '22023';
  end if;

  insert into public.aahana_agent_task_events (task_id, run_id, event_type, attempt, summary, metadata)
  values (v_task.id, v_task.run_id, 'task_completed', v_task.attempts,
    'Worker completed the internal task and saved its deliverable.',
    jsonb_build_object('result_keys', (select coalesce(jsonb_agg(key), '[]'::jsonb) from jsonb_object_keys(p_result) as key)));

  return v_task;
end;
$$;

create or replace function public.aahana_fail_agent_task(
  p_task_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns public.aahana_agent_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.aahana_agent_tasks;
  v_next_status text;
  v_delay_seconds integer;
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'Invalid worker error code' using errcode = '22023';
  end if;

  select * into v_task from public.aahana_agent_tasks
  where id = p_task_id and status = 'claimed'
    and lease_token = p_lease_token and lease_expires_at > now()
  for update;

  if not found then
    raise exception 'Task lease is no longer valid' using errcode = '22023';
  end if;

  v_next_status := case when v_task.attempts >= 5 then 'blocked' else 'queued' end;
  v_delay_seconds := least(300, 15 * power(2, greatest(v_task.attempts - 1, 0))::integer);

  update public.aahana_agent_tasks
  set status = v_next_status,
      available_at = case when v_next_status = 'queued' then now() + make_interval(secs => v_delay_seconds) else available_at end,
      finished_at = case when v_next_status = 'blocked' then now() else null end,
      lease_token = null, lease_expires_at = null,
      error_code = p_error_code, updated_at = now()
  where id = p_task_id
  returning * into v_task;

  insert into public.aahana_agent_task_events (task_id, run_id, event_type, attempt, summary, metadata)
  values (v_task.id, v_task.run_id,
    case when v_next_status = 'blocked' then 'task_blocked' else 'task_retried' end,
    v_task.attempts,
    case when v_next_status = 'blocked' then 'Task blocked after the retry limit.' else 'Task scheduled for a bounded retry.' end,
    jsonb_build_object('error_code', p_error_code, 'next_status', v_next_status, 'retry_delay_seconds', v_delay_seconds));

  return v_task;
end;
$$;

create or replace function public.aahana_finalize_agent_run(p_run_id uuid)
returns public.aahana_agent_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.aahana_agent_runs;
  v_pending integer;
  v_blocked integer;
  v_completed integer;
begin
  select * into v_run from public.aahana_agent_runs where id = p_run_id for update;
  if not found then return null; end if;

  select
    count(*) filter (where status in ('queued', 'claimed')),
    count(*) filter (where status = 'blocked'),
    count(*) filter (where status = 'completed')
  into v_pending, v_blocked, v_completed
  from public.aahana_agent_tasks where run_id = p_run_id;

  if v_pending = 0 and v_run.status = 'running' then
    update public.aahana_agent_runs
    set status = case when v_blocked > 0 then 'failed' else 'completed' end,
        finished_at = now(),
        summary = format('Worker cycle finished: %s completed, %s blocked.', v_completed, v_blocked),
        error_code = case when v_blocked > 0 then 'one_or_more_tasks_blocked' else null end
    where id = p_run_id returning * into v_run;
  end if;

  return v_run;
end;
$$;

revoke all on function public.aahana_claim_next_agent_task(integer) from public, anon, authenticated;
revoke all on function public.aahana_heartbeat_agent_task(uuid, uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.aahana_complete_agent_task(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.aahana_fail_agent_task(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.aahana_finalize_agent_run(uuid) from public, anon, authenticated;
grant execute on function public.aahana_claim_next_agent_task(integer) to service_role;
grant execute on function public.aahana_heartbeat_agent_task(uuid, uuid, jsonb, integer) to service_role;
grant execute on function public.aahana_complete_agent_task(uuid, uuid, jsonb) to service_role;
grant execute on function public.aahana_fail_agent_task(uuid, uuid, text) to service_role;
grant execute on function public.aahana_finalize_agent_run(uuid) to service_role;
