create table if not exists public.corrected_mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid null references public.conversation_sessions(id) on delete set null,
  message_id uuid null references public.conversation_messages(id) on delete set null,
  original_text text not null,
  corrected_text text not null,
  explanation text null,
  category text not null default 'Conversation',
  level text not null default 'A2',
  status text not null default 'new' check (status in ('new', 'review_due', 'reviewed', 'mastered', 'archived')),
  mastery_level integer not null default 0 check (mastery_level >= 0 and mastery_level <= 100),
  times_reviewed integer not null default 0,
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists corrected_mistakes_user_created_idx
  on public.corrected_mistakes (user_id, created_at desc);

create index if not exists corrected_mistakes_user_review_idx
  on public.corrected_mistakes (user_id, next_review_at);

alter table public.corrected_mistakes enable row level security;

drop policy if exists "Users can read own corrected mistakes" on public.corrected_mistakes;
create policy "Users can read own corrected mistakes"
  on public.corrected_mistakes
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own corrected mistakes" on public.corrected_mistakes;
create policy "Users can insert own corrected mistakes"
  on public.corrected_mistakes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own corrected mistakes" on public.corrected_mistakes;
create policy "Users can update own corrected mistakes"
  on public.corrected_mistakes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own corrected mistakes" on public.corrected_mistakes;
create policy "Users can delete own corrected mistakes"
  on public.corrected_mistakes
  for delete
  using (auth.uid() = user_id);
