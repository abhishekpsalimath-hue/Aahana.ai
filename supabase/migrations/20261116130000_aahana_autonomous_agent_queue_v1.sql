-- Aahana autonomous executive cycle: system-owned queue, isolated from user workspaces.
create table if not exists public.aahana_agent_runs (
  id uuid primary key default gen_random_uuid(),
  cycle_key text not null unique check (char_length(cycle_key) between 1 and 80),
  trigger_source text not null check (trigger_source in ('vercel_cron', 'manual_internal')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary text,
  error_code text
);
create index if not exists aahana_agent_runs_started_idx
  on public.aahana_agent_runs (started_at desc);

create table if not exists public.aahana_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.aahana_agent_runs(id) on delete cascade,
  dedupe_key text not null unique check (char_length(dedupe_key) between 1 and 160),
  role text not null check (role in ('ceo', 'cto', 'coo', 'cmo')),
  task_type text not null check (task_type in ('daily_review', 'health_review', 'brain_quality_review', 'growth_review')),
  title text not null check (char_length(title) between 1 and 180),
  instructions text not null check (char_length(instructions) between 1 and 4000),
  status text not null default 'queued' check (status in ('queued', 'claimed', 'completed', 'blocked', 'cancelled')),
  priority integer not null default 50 check (priority between 1 and 100),
  attempts integer not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object' and pg_column_size(result) <= 16384),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aahana_agent_tasks_queue_idx
  on public.aahana_agent_tasks (status, priority desc, available_at asc);
create index if not exists aahana_agent_tasks_run_idx
  on public.aahana_agent_tasks (run_id, created_at asc);

alter table public.aahana_agent_runs enable row level security;
alter table public.aahana_agent_tasks enable row level security;
revoke all on public.aahana_agent_runs from anon, authenticated;
revoke all on public.aahana_agent_tasks from anon, authenticated;
grant select, insert, update on public.aahana_agent_runs to service_role;
grant select, insert, update on public.aahana_agent_tasks to service_role;
