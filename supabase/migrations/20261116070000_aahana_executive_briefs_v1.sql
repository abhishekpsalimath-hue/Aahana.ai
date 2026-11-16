create table if not exists public.aahana_exec_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  objective text not null check (char_length(objective) between 1 and 4000),
  project_label text not null default '' check (char_length(project_label) <= 120),
  specialist_reports jsonb not null default '{}'::jsonb check (jsonb_typeof(specialist_reports) = 'object' and pg_column_size(specialist_reports) <= 65536),
  ceo_decision_brief text not null check (char_length(ceo_decision_brief) between 1 and 16000),
  status text not null default 'draft' check (status in ('draft', 'accepted', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists aahana_exec_briefs_user_created_idx on public.aahana_exec_briefs (user_id, created_at desc);
alter table public.aahana_exec_briefs enable row level security;
revoke all on public.aahana_exec_briefs from anon;
grant select, insert, update on public.aahana_exec_briefs to authenticated;
drop policy if exists "Users can read their own executive briefs" on public.aahana_exec_briefs;
create policy "Users can read their own executive briefs" on public.aahana_exec_briefs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their own executive briefs" on public.aahana_exec_briefs;
create policy "Users can create their own executive briefs" on public.aahana_exec_briefs for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own executive briefs" on public.aahana_exec_briefs;
create policy "Users can update their own executive briefs" on public.aahana_exec_briefs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);