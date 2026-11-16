-- Restrict task state changes to a validated, owner-scoped transition function.
revoke update, delete on public.aahana_ops_tasks from authenticated;

create or replace function public.aahana_transition_ops_task(
  p_task_id uuid,
  p_action text
)
returns public.aahana_ops_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.aahana_ops_tasks;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_task
  from public.aahana_ops_tasks
  where id = p_task_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  if p_action = 'approve' and v_task.status = 'proposed' then
    update public.aahana_ops_tasks
    set status = 'approved', approved_at = now(), updated_at = now()
    where id = p_task_id and user_id = v_user_id
    returning * into v_task;
  elsif p_action = 'cancel' and v_task.status in ('proposed', 'approved', 'blocked') then
    update public.aahana_ops_tasks
    set status = 'cancelled', updated_at = now()
    where id = p_task_id and user_id = v_user_id
    returning * into v_task;
  elsif p_action = 'reopen' and v_task.status in ('cancelled', 'blocked') then
    update public.aahana_ops_tasks
    set status = 'proposed', approved_at = null, completed_at = null, updated_at = now()
    where id = p_task_id and user_id = v_user_id
    returning * into v_task;
  else
    raise exception 'Invalid task state transition' using errcode = '22023';
  end if;

  return v_task;
end;
$$;

revoke all on function public.aahana_transition_ops_task(uuid, text) from public, anon;
grant execute on function public.aahana_transition_ops_task(uuid, text) to authenticated;

-- Brief content is immutable to ordinary authenticated clients after creation.
revoke update on public.aahana_exec_briefs from authenticated;
drop policy if exists "Users can update their own executive briefs" on public.aahana_exec_briefs;