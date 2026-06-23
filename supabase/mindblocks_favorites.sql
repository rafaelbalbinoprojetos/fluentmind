alter table public.mindblocks
add column if not exists is_favorite boolean not null default false;

create index if not exists mindblocks_user_favorite_idx
on public.mindblocks (user_id, is_favorite)
where is_favorite = true;
