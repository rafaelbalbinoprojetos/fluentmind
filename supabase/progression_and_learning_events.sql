create table if not exists public.user_progression_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  total_xp integer not null default 0,
  current_level integer not null default 1,
  streak integer not null default 0,
  last_activity_at timestamptz null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists user_progression_state_level_idx
  on public.user_progression_state (current_level desc, total_xp desc);

create table if not exists public.learning_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  source text not null default 'app',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learning_events_user_created_idx
  on public.learning_events (user_id, created_at desc);

create index if not exists learning_events_user_type_idx
  on public.learning_events (user_id, event_type, created_at desc);

alter table public.user_progression_state enable row level security;
alter table public.learning_events enable row level security;

drop policy if exists "Users can read own progression state" on public.user_progression_state;
create policy "Users can read own progression state"
  on public.user_progression_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own progression state" on public.user_progression_state;
create policy "Users can insert own progression state"
  on public.user_progression_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own progression state" on public.user_progression_state;
create policy "Users can update own progression state"
  on public.user_progression_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own progression state" on public.user_progression_state;
create policy "Users can delete own progression state"
  on public.user_progression_state
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own learning events" on public.learning_events;
create policy "Users can read own learning events"
  on public.learning_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own learning events" on public.learning_events;
create policy "Users can insert own learning events"
  on public.learning_events
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own learning events" on public.learning_events;
create policy "Users can update own learning events"
  on public.learning_events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own learning events" on public.learning_events;
create policy "Users can delete own learning events"
  on public.learning_events
  for delete
  using (auth.uid() = user_id);
