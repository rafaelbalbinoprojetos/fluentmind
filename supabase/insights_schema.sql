-- Tabela de insights automáticos
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null,
  highlights jsonb default '[]'::jsonb,
  actions jsonb default '[]'::jsonb,
  period_start date null,
  period_end date null,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.insights enable row level security;

create policy if not exists "Users can view own insights"
on public.insights
for select
using (auth.uid() = user_id);

create policy if not exists "Users can insert own insights"
on public.insights
for insert
with check (auth.uid() = user_id);

create policy if not exists "Users can delete own insights"
on public.insights
for delete
using (auth.uid() = user_id);
