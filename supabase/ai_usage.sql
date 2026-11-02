-- Apply before deploying the API changes. Only service_role can reserve usage.
begin;
create table if not exists public.ai_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  month date not null default date_trunc('month', now() at time zone 'UTC')::date,
  ai_chat integer not null default 0,
  ai_registros integer not null default 0,
  ai_analises integer not null default 0,
  ai_relatorios integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from public, anon, authenticated;
grant all on public.ai_usage to service_role;

create or replace function public.consume_ai_usage(p_user_id uuid, p_amount integer, p_limit integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_month date := date_trunc('month', now() at time zone 'UTC')::date;
  usage_row public.ai_usage%rowtype;
begin
  if p_user_id is null or p_amount is null or p_amount < 1
    or p_limit is null or p_limit < 1 or p_amount > p_limit then
    raise exception 'invalid_ai_usage';
  end if;
  insert into public.ai_usage (user_id, month)
  values (p_user_id, current_month) on conflict (user_id) do nothing;
  select * into usage_row from public.ai_usage where user_id = p_user_id for update;
  if usage_row.month is distinct from current_month then
    usage_row.ai_chat := 0;
    usage_row.ai_registros := 0;
    usage_row.ai_analises := 0;
    usage_row.ai_relatorios := 0;
  end if;
  if coalesce(usage_row.ai_chat, 0) > p_limit - p_amount then
    raise exception 'ai_limit_reached';
  end if;
  update public.ai_usage set month = current_month,
    ai_chat = coalesce(usage_row.ai_chat, 0) + p_amount,
    ai_registros = usage_row.ai_registros, ai_analises = usage_row.ai_analises,
    ai_relatorios = usage_row.ai_relatorios, updated_at = now()
  where user_id = p_user_id returning * into usage_row;
  return to_jsonb(usage_row);
end;
$$;
revoke all on function public.consume_ai_usage(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_usage(uuid, integer, integer) to service_role;

-- First activation is permanent; retries and concurrent calls never extend it.
create table if not exists public.ai_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
alter table public.ai_trials enable row level security;
revoke all on public.ai_trials from public, anon, authenticated;
grant all on public.ai_trials to service_role;

create or replace function public.start_ai_trial(p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  trial_row public.ai_trials%rowtype;
begin
  insert into public.ai_trials (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into trial_row from public.ai_trials where user_id = p_user_id;
  return jsonb_build_object(
    'trial_started_at', trial_row.started_at,
    'trial_expires_at', trial_row.expires_at,
    'trial_status', case when trial_row.expires_at > now() then 'active' else 'expired' end
  );
end;
$$;
revoke all on function public.start_ai_trial(uuid) from public, anon, authenticated;
grant execute on function public.start_ai_trial(uuid) to service_role;
commit;
