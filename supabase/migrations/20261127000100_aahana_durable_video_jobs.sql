-- Draft only: durable video-job persistence. Do not apply to production without explicit owner approval.
create table if not exists public.aahana_video_jobs (
  job_id text primary key check (char_length(job_id) between 1 and 100),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 100),
  revision integer not null default 1 check (revision >= 1),
  state text not null check (state in ('queued','running','succeeded','failed','cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  attempt integer not null default 0 check (attempt between 0 and 3),
  max_attempts integer not null default 3 check (max_attempts between 1 and 3),
  retryable boolean not null default false,
  error_code text check (error_code is null or error_code ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  constraint aahana_video_jobs_attempt_limit check (attempt <= max_attempts),
  constraint aahana_video_jobs_owner_idempotency_unique unique (owner_id, idempotency_key)
);

create index if not exists aahana_video_jobs_owner_updated_idx
  on public.aahana_video_jobs (owner_id, updated_at desc);
create index if not exists aahana_video_jobs_queued_idx
  on public.aahana_video_jobs (created_at asc)
  where state = 'queued';

alter table public.aahana_video_jobs enable row level security;

create policy "Owners can read their own video jobs"
  on public.aahana_video_jobs for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can create their own video jobs"
  on public.aahana_video_jobs for insert to authenticated
  with check ((select auth.uid()) = owner_id and state = 'queued' and revision = 1 and attempt = 0 and progress = 0);
create policy "Owners can update their own video jobs"
  on public.aahana_video_jobs for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create or replace function public.guard_aahana_video_job_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.state <> 'queued' or new.revision <> 1 or new.attempt <> 0
       or new.progress <> 0 or new.retryable or new.started_at is not null
       or new.completed_at is not null or new.error_code is not null then
      raise exception 'video job must begin as a canonical queued snapshot';
    end if;
    return new;
  end if;

  if new.job_id <> old.job_id or new.owner_id <> old.owner_id
     or new.idempotency_key <> old.idempotency_key
     or new.created_at <> old.created_at or new.max_attempts <> old.max_attempts then
    raise exception 'video job identity and creation metadata are immutable';
  end if;
  if new.revision <> old.revision + 1 or new.updated_at < old.updated_at
     or new.updated_at < new.created_at then
    raise exception 'video job revision and timestamps must advance monotonically';
  end if;
  if (new.started_at is not null and new.started_at < new.created_at)
     or (new.completed_at is not null and new.completed_at < coalesce(new.started_at, new.created_at)) then
    raise exception 'video job lifecycle timestamps must be chronologically coherent';
  end if;
  if new.retryable and (new.state <> 'failed' or new.attempt >= new.max_attempts) then
    raise exception 'only failed jobs with attempts remaining may be retryable';
  end if;

  if old.state = 'queued' and new.state = 'running' then
    if new.attempt <> old.attempt + 1 or new.progress <> 0 or new.retryable
       or new.started_at is null or new.completed_at is not null or new.error_code is not null then
      raise exception 'invalid queued-to-running video job transition';
    end if;
  elsif old.state = 'queued' and new.state = 'cancelled' then
    if new.attempt <> old.attempt or new.progress <> old.progress or new.retryable
       or new.started_at is not null or new.completed_at is null or new.error_code is not null then
      raise exception 'invalid queued-to-cancelled video job transition';
    end if;
  elsif old.state = 'running' and new.state = 'running' then
    if new.attempt <> old.attempt or new.progress < old.progress or new.progress > 99
       or new.retryable or new.started_at <> old.started_at
       or new.completed_at is not null or new.error_code is not null then
      raise exception 'invalid running video job progress update';
    end if;
  elsif old.state = 'running' and new.state = 'succeeded' then
    if new.attempt <> old.attempt or new.progress <> 100 or new.retryable
       or new.started_at <> old.started_at or new.completed_at is null or new.error_code is not null then
      raise exception 'invalid running-to-succeeded video job transition';
    end if;
  elsif old.state = 'running' and new.state = 'failed' then
    if new.attempt <> old.attempt or new.progress <> old.progress
       or new.started_at <> old.started_at or new.completed_at is null or new.error_code is null
       or (new.retryable and new.attempt >= new.max_attempts) then
      raise exception 'invalid running-to-failed video job transition';
    end if;
  elsif old.state = 'running' and new.state = 'cancelled' then
    if new.attempt <> old.attempt or new.progress <> old.progress or new.retryable
       or new.started_at <> old.started_at or new.completed_at is null or new.error_code is not null then
      raise exception 'invalid running-to-cancelled video job transition';
    end if;
  elsif old.state = 'failed' and new.state = 'queued' then
    if not old.retryable or old.attempt >= old.max_attempts or new.attempt <> old.attempt
       or new.progress <> 0 or new.retryable or new.started_at is not null
       or new.completed_at is not null or new.error_code is not null then
      raise exception 'invalid failed-to-queued video job retry';
    end if;
  else
    raise exception 'unsupported video job lifecycle transition';
  end if;
  return new;
end;
$$;

drop trigger if exists aahana_video_jobs_transition_guard on public.aahana_video_jobs;
create trigger aahana_video_jobs_transition_guard
  before insert or update on public.aahana_video_jobs
  for each row execute function public.guard_aahana_video_job_transition();

grant select, insert, update on public.aahana_video_jobs to authenticated;
