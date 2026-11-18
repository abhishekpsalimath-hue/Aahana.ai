create table if not exists public.aahana_build_locks (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  project_id uuid not null,
  lock_token uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.aahana_build_locks enable row level security;
revoke all on table public.aahana_build_locks from anon, authenticated;

create or replace function public.acquire_aahana_build_lock(
  p_project_id uuid,
  p_lock_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  acquired boolean := false;
  caller_id uuid := auth.uid();
begin
  if caller_id is null or p_project_id is null or p_lock_token is null then
    return false;
  end if;

  insert into public.aahana_build_locks (owner_id, project_id, lock_token, expires_at)
  values (caller_id, p_project_id, p_lock_token, now() + interval '4 minutes')
  on conflict (owner_id) do update
    set project_id = excluded.project_id,
        lock_token = excluded.lock_token,
        expires_at = excluded.expires_at,
        created_at = now()
    where public.aahana_build_locks.expires_at <= now()
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

create or replace function public.release_aahana_build_lock(p_lock_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  released boolean := false;
  caller_id uuid := auth.uid();
begin
  if caller_id is null or p_lock_token is null then
    return false;
  end if;

  delete from public.aahana_build_locks
  where owner_id = caller_id and lock_token = p_lock_token
  returning true into released;

  return coalesce(released, false);
end;
$$;

revoke all on function public.acquire_aahana_build_lock(uuid, uuid) from public, anon;
revoke all on function public.release_aahana_build_lock(uuid) from public, anon;
grant execute on function public.acquire_aahana_build_lock(uuid, uuid) to authenticated;
grant execute on function public.release_aahana_build_lock(uuid) to authenticated;
