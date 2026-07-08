alter table public.profiles
  add column if not exists storage_used_bytes bigint not null default 0,
  add column if not exists storage_quota_bytes bigint not null default 10737418240;

alter table public.repositories
  add column if not exists storage_used_bytes bigint not null default 0,
  add column if not exists storage_quota_bytes bigint not null default 5368709120,
  add column if not exists current_bucket text,
  add column if not exists latest_commit_id uuid;

alter table public.repository_commits
  add column if not exists total_bytes bigint not null default 0,
  add column if not exists bucket_name text,
  add column if not exists asset_class text not null default 'repo';

create table if not exists public.cli_login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_code text not null unique,
  device_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'expired', 'consumed')),
  requested_label text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_token text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.cli_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  token_name text,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.cli_login_sessions enable row level security;
alter table public.cli_tokens enable row level security;

create policy "cli_login_sessions_owner_read"
on public.cli_login_sessions
for select
using (approved_by = auth.uid());

create policy "cli_tokens_owner_read"
on public.cli_tokens
for select
using (owner_id = auth.uid());
