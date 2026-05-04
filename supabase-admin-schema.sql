-- Run this in: Supabase dashboard → SQL Editor → New query
-- This adds admin capabilities on top of supabase-schema.sql

-- ── is_admin() ────────────────────────────────────────────────────────────────
-- Returns true when the calling user is the designated admin.
-- Update the email here to change who has admin access.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from auth.users
    where id   = auth.uid()
    and   email = 'rotabush@gmail.com'
  );
$$;

-- ── get_all_user_stats() ──────────────────────────────────────────────────────
-- Admin-only RPC: returns every user's stats joined with their email.
-- Runs as the postgres superuser (security definer) so it can read auth.users.
-- Raises an error if the caller is not an admin.
create or replace function public.get_all_user_stats()
returns table (
  user_id    uuid,
  email      text,
  decisions  integer,
  correct    integer,
  updated_at timestamptz
)
language plpgsql
security definer
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: admin only';
  end if;

  return query
    select
      s.user_id,
      u.email::text,
      s.decisions,
      s.correct,
      s.updated_at
    from public.user_stats s
    join auth.users u on u.id = s.user_id
    order by s.decisions desc, s.correct desc;
end;
$$;
