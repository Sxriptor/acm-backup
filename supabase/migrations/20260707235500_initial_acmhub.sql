create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.repositories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  source_path text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, slug)
);

create table if not exists public.repository_commits (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories(id) on delete cascade,
  commit_message text not null,
  branch_name text not null default 'main',
  tree_sha text not null,
  archive_key text,
  file_count integer not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger repositories_set_updated_at
before update on public.repositories
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), new.email)
  )
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.repositories enable row level security;
alter table public.repository_commits enable row level security;

create policy "profiles_select_authenticated"
on public.profiles
for select
using (auth.role() = 'authenticated');

create policy "profiles_insert_self"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_self"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "repositories_owner_full_access"
on public.repositories
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "repositories_public_read"
on public.repositories
for select
using (visibility = 'public' or auth.uid() = owner_id);

create policy "repository_commits_owner_read_write"
on public.repository_commits
for all
using (
  exists (
    select 1 from public.repositories r
    where r.id = repository_id and r.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.repositories r
    where r.id = repository_id and r.owner_id = auth.uid()
  )
);
