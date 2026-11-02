-- Executar dentro do Supabase SQL Editor ou CLI após ajustar os emails master, se necessário.
begin;
create table if not exists public.ultra_access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid null references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  granted_by uuid null,
  granted_by_email text null,
  revoked_at timestamptz null,
  plan text not null default 'premium',
  expires_at timestamptz null,
  status text not null default 'active',
  confirmed_at timestamptz null,
  confirmation_sent_at timestamptz null,
  confirmation_expires_at timestamptz null,
  confirmation_token_hash text null
);

alter table public.ultra_access_grants
  add column if not exists user_id uuid null references auth.users(id) on delete set null,
  add column if not exists plan text not null default 'premium',
  add column if not exists expires_at timestamptz null,
  add column if not exists status text not null default 'active',
  add column if not exists confirmed_at timestamptz null,
  add column if not exists confirmation_sent_at timestamptz null,
  add column if not exists confirmation_expires_at timestamptz null,
  add column if not exists confirmation_token_hash text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ultra_access_grants_status_check'
  ) then
    alter table public.ultra_access_grants
      add constraint ultra_access_grants_status_check
      check (status = any (array['pending'::text, 'active'::text, 'revoked'::text]));
  end if;
end $$;

create index if not exists idx_ultra_access_grants_email on public.ultra_access_grants(email);
create index if not exists idx_ultra_access_grants_user_id on public.ultra_access_grants(user_id);
create index if not exists idx_ultra_access_grants_status on public.ultra_access_grants(status);

alter table public.ultra_access_grants enable row level security;

drop policy if exists "authenticated-can-read-ultra-access" on public.ultra_access_grants;
drop policy if exists "users-can-read-own-ultra-access" on public.ultra_access_grants;
create policy "users-can-read-own-ultra-access"
on public.ultra_access_grants
for select to authenticated
using (auth.uid() = user_id or (user_id is null and lower(email) = lower(auth.jwt() ->> 'email')));

drop policy if exists "master-can-manage-ultra-access" on public.ultra_access_grants;
create policy "master-can-manage-ultra-access"
on public.ultra_access_grants
for all to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'balbino10@hotmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'balbino10@hotmail.com');
commit;
