-- Aahana Self-Operations v1
-- User-owned operational tasks/events plus a server-only platform event ledger.
-- No client can execute workflows or read platform-wide telemetry.

create table if not exists public.aahana_ops_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '' check (char_length(description) <= 8000),
  assigned_role text not null default 'ceo'
    check (assigned_role in ('ceo', 'cto', 'coo', 'cmo')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'in_progress', 'blocked', 'completed', 'cancelled')),
  source text not null default 'manual'
    check (source in ('manual', 'executive', 'self_ops')),
  approval_required boolean not null default true,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or approved_at is not null),
  check (status <> 'completed' or completed_at is not null)
);

create index if not exists aahana_ops_tasks_user_updated_idx
  on public.aahana_ops_tasks (user_id, updated_at desc);

alter table public.aahana_ops_tasks enable row level security;
revoke all on public.aahana_ops_tasks from anon;
grant select, insert, update, delete on public.aahana_ops_tasks to authenticated;

drop policy if exists "Users can read their own Aahana ops tasks" on public.aahana_ops_tasks;
create policy "Users can read their own Aahana ops tasks"
  on public.aahana_ops_tasks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own Aahana ops tasks" on public.aahana_ops_tasks;
create policy "Users can create their own Aahana ops tasks"
  on public.aahana_ops_tasks for insert to authenticated
  with check ((select auth.uid()) = user_id and approval_required = true);

drop policy if exists "Users can update their own Aahana ops tasks" on public.aahana_ops_tasks;
create policy "Users can update their own Aahana ops tasks"
  on public.aahana_ops_tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own Aahana ops tasks" on public.aahana_ops_tasks;
create policy "Users can delete their own Aahana ops tasks"
  on public.aahana_ops_tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.aahana_ops_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null
    check (event_type in ('quality_feedback', 'task_blocked', 'task_completed', 'workflow_error', 'user_report')),
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'error', 'critical')),
  source text not null default 'workspace'
    check (source in ('workspace', 'executive', 'self_ops')),
  summary text not null check (char_length(summary) between 1 and 240),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 8192),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists aahana_ops_events_user_created_idx
  on public.aahana_ops_events (user_id, created_at desc);

alter table public.aahana_ops_events enable row level security;
revoke all on public.aahana_ops_events from anon;
grant select, insert on public.aahana_ops_events to authenticated;

drop policy if exists "Users can read their own Aahana ops events" on public.aahana_ops_events;
create policy "Users can read their own Aahana ops events"
  on public.aahana_ops_events for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own Aahana ops events" on public.aahana_ops_events;
create policy "Users can create their own Aahana ops events"
  on public.aahana_ops_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Platform telemetry is separate from user workspace data.
-- RLS is enabled with no anon/authenticated policies or grants.
-- Only a trusted server-side service-role client may write/read this ledger.
create table if not exists public.aahana_system_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (char_length(event_type) between 1 and 80),
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'error', 'critical')),
  source text not null check (char_length(source) between 1 and 80),
  summary text not null check (char_length(summary) between 1 and 240),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 8192),
  created_at timestamptz not null default now()
);

create index if not exists aahana_system_events_created_idx
  on public.aahana_system_events (created_at desc);
create index if not exists aahana_system_events_type_created_idx
  on public.aahana_system_events (event_type, created_at desc);

alter table public.aahana_system_events enable row level security;
revoke all on public.aahana_system_events from anon, authenticated;
