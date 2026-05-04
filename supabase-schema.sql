-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard → your project → SQL Editor → New query

-- Lifetime strategy stats (one row per user, upserted after each hand)
create table if not exists public.user_stats (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete cascade not null unique,
  decisions   integer     not null default 0,
  correct     integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Row Level Security — users can only read and write their own row
alter table public.user_stats enable row level security;

create policy "users_select_own" on public.user_stats
  for select using (auth.uid() = user_id);

create policy "users_insert_own" on public.user_stats
  for insert with check (auth.uid() = user_id);

create policy "users_update_own" on public.user_stats
  for update using (auth.uid() = user_id);
