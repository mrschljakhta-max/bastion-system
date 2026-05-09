-- =========================================================
-- BASTION — Access Invites + Roles + Admin RPC
-- Apply in Supabase SQL Editor.
-- =========================================================

create extension if not exists pgcrypto;

-- 1) Harden allowed_users structure
alter table public.allowed_users
  add column if not exists updated_at timestamptz,
  add column if not exists invited_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists created_by text;

alter table public.allowed_users
  alter column role set default 'demo',
  alter column status set default 'active',
  alter column is_active set default true;

alter table public.allowed_users
  drop constraint if exists allowed_users_role_check;

alter table public.allowed_users
  add constraint allowed_users_role_check
  check (role in ('demo', 'user', 'supervisor', 'admin'));

alter table public.allowed_users
  drop constraint if exists allowed_users_status_check;

alter table public.allowed_users
  add constraint allowed_users_status_check
  check (status in ('invited', 'active', 'blocked', 'disabled'));

-- 2) Invite table
create table if not exists public.user_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('demo', 'user', 'supervisor', 'admin')),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  accepted_at timestamptz
);

create index if not exists idx_user_invites_email on public.user_invites (lower(email));
create index if not exists idx_user_invites_token on public.user_invites (token);
create index if not exists idx_user_invites_status on public.user_invites (status);

-- 3) Helpers
create or replace function public.current_auth_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', auth.email(), ''));
$$;

create or replace function public.is_current_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_users au
    where lower(au.email) = public.current_auth_email()
      and au.role = 'admin'
      and au.status = 'active'
      and au.is_active = true
  );
$$;

-- 4) Main profile / allowed checks
create or replace function public.get_my_access_profile()
returns table (
  email text,
  role text,
  status text,
  is_active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select au.email, au.role, au.status, au.is_active, au.created_at
  from public.allowed_users au
  where lower(au.email) = public.current_auth_email()
  limit 1;
$$;

create or replace function public.is_email_allowed(input_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_users au
    where lower(au.email) = lower(trim(input_email))
      and au.status = 'active'
      and au.is_active = true
  );
$$;

-- 5) Admin creates invite
create or replace function public.admin_create_user_invite(
  input_email text,
  input_role text,
  input_note text default null
)
returns table (
  id uuid,
  email text,
  role text,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(input_email));
  v_role text := lower(trim(input_role));
  v_invite public.user_invites;
begin
  if not public.is_current_admin() then
    raise exception 'Admin access required';
  end if;

  if v_email = '' or v_email is null then
    raise exception 'Email is required';
  end if;

  if v_role not in ('demo', 'user', 'supervisor') then
    raise exception 'Invalid role for invite: %', v_role;
  end if;

  insert into public.allowed_users (email, role, status, is_active, invited_at, created_by, updated_at)
  values (v_email, v_role, 'invited', false, now(), public.current_auth_email(), now())
  on conflict (email) do update set
    role = excluded.role,
    status = 'invited',
    is_active = false,
    invited_at = now(),
    created_by = public.current_auth_email(),
    updated_at = now();

  update public.user_invites
  set status = 'revoked'
  where lower(email) = v_email
    and status = 'pending';

  insert into public.user_invites (email, role, note, created_by)
  values (v_email, v_role, input_note, public.current_auth_email())
  returning * into v_invite;

  insert into public.activity_logs (email, action, details)
  values (
    public.current_auth_email(),
    'admin_create_user_invite',
    jsonb_build_object('target_email', v_email, 'role', v_role, 'invite_id', v_invite.id)
  );

  return query select v_invite.id, v_invite.email, v_invite.role, v_invite.token, v_invite.expires_at;
end;
$$;

-- 6) Public token lookup for setup page
create or replace function public.get_invite_by_token(input_token text)
returns table (
  email text,
  role text,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select ui.email, ui.role, ui.expires_at
  from public.user_invites ui
  where ui.token = trim(input_token)
    and ui.status = 'pending'
    and ui.expires_at > now()
  limit 1;
$$;

-- 7) Activate invite after password + MFA verification
create or replace function public.activate_user_invite(input_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.user_invites;
  v_email text := public.current_auth_email();
begin
  if v_email is null or v_email = '' then
    raise exception 'Authenticated session required';
  end if;

  select * into v_invite
  from public.user_invites
  where token = trim(input_token)
    and status = 'pending'
    and expires_at > now()
  limit 1;

  if v_invite.id is null then
    raise exception 'Invite not found or expired';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'Invite email does not match current user';
  end if;

  update public.user_invites
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  update public.allowed_users
  set status = 'active', is_active = true, activated_at = now(), updated_at = now()
  where lower(email) = v_email;

  insert into public.activity_logs (email, action, details)
  values (v_email, 'user_invite_activated', jsonb_build_object('invite_id', v_invite.id, 'role', v_invite.role));

  return true;
end;
$$;

-- 8) Admin read RPC
create or replace function public.admin_list_allowed_users()
returns table (
  email text,
  role text,
  status text,
  is_active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select au.email, au.role, au.status, au.is_active, au.created_at
  from public.allowed_users au
  where public.is_current_admin()
  order by au.created_at desc;
$$;

create or replace function public.admin_list_access_requests()
returns table (
  id uuid,
  email text,
  status text,
  requested_at timestamptz,
  processed_at timestamptz,
  note text
)
language sql
security definer
set search_path = public
as $$
  select ar.id, ar.email, ar.status, ar.requested_at, ar.processed_at, ar.note
  from public.access_requests ar
  where public.is_current_admin()
  order by ar.requested_at desc
  limit 200;
$$;

create or replace function public.admin_list_activity_logs()
returns table (
  id bigint,
  email text,
  action text,
  details jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select al.id, al.email, al.action, al.details, al.created_at
  from public.activity_logs al
  where public.is_current_admin()
  order by al.created_at desc
  limit 300;
$$;

-- 9) RLS baseline. Keep RPC as controlled access path.
alter table public.allowed_users enable row level security;
alter table public.access_requests enable row level security;
alter table public.activity_logs enable row level security;
alter table public.user_invites enable row level security;

drop policy if exists "access_requests_insert_anon" on public.access_requests;
create policy "access_requests_insert_anon"
  on public.access_requests
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "activity_logs_insert_authenticated" on public.activity_logs;
create policy "activity_logs_insert_authenticated"
  on public.activity_logs
  for insert
  to authenticated
  with check (true);

-- 10) Bootstrap first admin manually once, then remove/avoid reusing this line.
-- insert into public.allowed_users (email, role, status, is_active)
-- values ('your-admin@email.com', 'admin', 'active', true)
-- on conflict (email) do update set role='admin', status='active', is_active=true, updated_at=now();
