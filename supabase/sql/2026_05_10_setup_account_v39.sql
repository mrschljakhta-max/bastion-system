-- BASTION setup-account v39 helper
-- Run this in Supabase SQL editor ONLY if you do not already have your own invite completion RPC.
-- This RPC stores login metadata and marks invite as used.
-- Password handling should normally be done through Supabase Auth, not plain tables.

create table if not exists public.user_access_credentials (
  id uuid primary key default gen_random_uuid(),
  invite_token text unique,
  login text unique not null,
  password_hash text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  mfa_required boolean not null default true
);

create or replace function public.complete_invite_setup_v2(
  p_token text,
  p_login text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_access_credentials;
begin
  if coalesce(trim(p_login), '') = '' then
    raise exception 'Login is required';
  end if;

  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Password is too short';
  end if;

  insert into public.user_access_credentials (
    invite_token,
    login,
    password_hash,
    activated_at,
    mfa_required
  )
  values (
    nullif(p_token, ''),
    lower(trim(p_login)),
    crypt(p_password, gen_salt('bf')),
    now(),
    true
  )
  on conflict (login)
  do update set
    password_hash = excluded.password_hash,
    invite_token = excluded.invite_token,
    activated_at = now(),
    mfa_required = true
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'login', v_row.login,
    'mfa_required', v_row.mfa_required
  );
end;
$$;

grant execute on function public.complete_invite_setup_v2(text, text, text) to anon, authenticated;
