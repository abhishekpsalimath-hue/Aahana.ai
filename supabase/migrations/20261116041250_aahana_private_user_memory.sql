create table if not exists public.user_memory_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  consented_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint user_memory_settings_consent_consistency
    check ((enabled = false) or (consented_at is not null))
);

create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1200),
  category text not null default 'personal' check (category in ('personal','preference','project','goal','other')),
  source text not null default 'user' check (source in ('user','conversation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_memories_user_updated_idx
  on public.user_memories (user_id, updated_at desc);

alter table public.user_memory_settings enable row level security;
alter table public.user_memories enable row level security;

drop policy if exists user_memory_settings_select_own on public.user_memory_settings;
create policy user_memory_settings_select_own on public.user_memory_settings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_memory_settings_insert_own on public.user_memory_settings;
create policy user_memory_settings_insert_own on public.user_memory_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists user_memory_settings_update_own on public.user_memory_settings;
create policy user_memory_settings_update_own on public.user_memory_settings
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists user_memories_select_own on public.user_memories;
create policy user_memories_select_own on public.user_memories
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_memories_insert_own on public.user_memories;
create policy user_memories_insert_own on public.user_memories
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists user_memories_update_own on public.user_memories;
create policy user_memories_update_own on public.user_memories
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists user_memories_delete_own on public.user_memories;
create policy user_memories_delete_own on public.user_memories
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update on public.user_memory_settings to authenticated;
grant select, insert, update, delete on public.user_memories to authenticated;
revoke all on public.user_memory_settings from anon;
revoke all on public.user_memories from anon;
