-- Creator Studio cloud workspace and private shared media bucket.
-- This migration was applied to the connected Supabase project as
-- add_creator_cloud_workspace_and_private_assets (20261118035802).

create table if not exists public.creator_workspace_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  schema_version smallint not null default 1 check (schema_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_workspace_documents_user_updated_idx
  on public.creator_workspace_documents (user_id, updated_at desc);

alter table public.creator_workspace_documents enable row level security;

create policy "creator_workspace_documents_select_own"
  on public.creator_workspace_documents for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = creator_workspace_documents.project_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "creator_workspace_documents_insert_own"
  on public.creator_workspace_documents for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = creator_workspace_documents.project_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "creator_workspace_documents_update_own"
  on public.creator_workspace_documents for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = creator_workspace_documents.project_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = creator_workspace_documents.project_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "creator_workspace_documents_delete_own"
  on public.creator_workspace_documents for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = creator_workspace_documents.project_id
        and p.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.creator_workspace_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aahana-studio-assets',
  'aahana-studio-assets',
  false,
  52428800,
  array[
    'image/png','image/jpeg','image/webp','image/gif','image/avif',
    'audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm',
    'video/mp4','video/webm','video/ogg',
    'model/gltf-binary','model/gltf+json','application/octet-stream',
    'font/woff','font/woff2','font/ttf','application/pdf','text/plain'
  ]
)
on conflict (id) do nothing;

create policy "aahana_studio_assets_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'aahana-studio-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "aahana_studio_assets_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'aahana-studio-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "aahana_studio_assets_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'aahana-studio-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'aahana-studio-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "aahana_studio_assets_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'aahana-studio-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
