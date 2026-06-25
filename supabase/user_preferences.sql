create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text null,
  assistant_name text not null default 'Neo',
  assistant_voice text not null default 'mineirinha',
  chat_tone text not null default 'natural',
  mindblock_save_mode text not null default 'ask'
    check (mindblock_save_mode in ('ask', 'auto', 'never')),
  theme_id text not null default 'fluentmind-night',
  interface_language text not null default 'pt-BR',
  native_language text not null default 'pt-BR',
  target_language text not null default 'en',
  current_level text not null default 'A2',
  daily_expression_goal integer not null default 30 check (daily_expression_goal > 0),
  practice_focus text not null default 'expressions'
    check (practice_focus in ('expressions', 'review', 'conversation')),
  show_toasts boolean not null default true,
  mobile_nav_paths text[] not null default array[
    '/dashboard',
    '/learning-journey',
    '/historico',
    '/biblioteca',
    '/playlists',
    '/insights',
    '/chatbot',
    '/conversas',
    '/meus-erros',
    '/configuracoes'
  ],
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists user_preferences_updated_idx
  on public.user_preferences (updated_at desc);

alter table public.user_preferences enable row level security;

drop policy if exists "Users can read own preferences" on public.user_preferences;
create policy "Users can read own preferences"
  on public.user_preferences
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own preferences" on public.user_preferences;
create policy "Users can insert own preferences"
  on public.user_preferences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own preferences" on public.user_preferences;
create policy "Users can update own preferences"
  on public.user_preferences
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own preferences" on public.user_preferences;
create policy "Users can delete own preferences"
  on public.user_preferences
  for delete
  using (auth.uid() = user_id);
