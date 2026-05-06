create extension if not exists btree_gist with schema extensions;

create or replace function public.time_text_to_minutes(time_text text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when time_text = '24:00' then 1440
    when time_text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      then split_part(time_text, ':', 1)::integer * 60 + split_part(time_text, ':', 2)::integer
    else null
  end
$$;

create or replace function public.is_ten_minute_time_text(time_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.time_text_to_minutes(time_text) is not null
    and public.time_text_to_minutes(time_text) % 10 = 0
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at is null or (tg_op = 'UPDATE' and new.updated_at is not distinct from old.updated_at) then
    new.updated_at = now();
  end if;

  return new;
end;
$$;

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  emoji text not null check (length(trim(emoji)) > 0),
  weekly_goal_minutes integer check (weekly_goal_minutes is null or weekly_goal_minutes >= 0),
  sort_order integer not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id)
);

create table public.time_entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  start_time text not null,
  end_time text not null,
  category_id text not null,
  note text not null default '',
  source text not null default 'manual' check (source in ('manual', 'template', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (public.is_ten_minute_time_text(start_time)),
  check (public.is_ten_minute_time_text(end_time)),
  check (start_time <> '24:00'),
  check (public.time_text_to_minutes(start_time) < public.time_text_to_minutes(end_time)),
  foreign key (user_id, category_id) references public.categories(user_id, id),
  unique (user_id, id)
);

alter table public.time_entries
  add constraint time_entries_no_overlap
  exclude using gist (
    user_id with =,
    date with =,
    int4range(
      public.time_text_to_minutes(start_time),
      public.time_text_to_minutes(end_time),
      '[)'
    ) with &&
  )
  where (deleted_at is null);

create table public.week_reviews (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null check (extract(isodow from week_start_date) = 1),
  summary text not null default '',
  wins text not null default '',
  problems text not null default '',
  next_week_focus text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, week_start_date),
  unique (user_id, id)
);

create table public.photo_references (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text,
  date date not null,
  captured_at timestamptz not null,
  local_asset_id text not null,
  thumbnail_remote_url text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  media_type text not null check (media_type in ('photo', 'video')),
  match_type text not null check (match_type in ('auto', 'manual')),
  is_hidden boolean not null default false,
  permission_scope text not null check (permission_scope in ('all', 'limited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (user_id, entry_id) references public.time_entries(user_id, id),
  unique (user_id, id)
);

create table public.settings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_starts_on text not null default 'monday' check (week_starts_on in ('monday', 'sunday')),
  visible_start_time text not null default '05:00',
  visible_end_time text not null default '24:00',
  use_full_day_view boolean not null default false,
  photo_matching_enabled boolean not null default false,
  thumbnail_sync_enabled boolean not null default false,
  last_opened_week_start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public.is_ten_minute_time_text(visible_start_time)),
  check (public.is_ten_minute_time_text(visible_end_time)),
  check (visible_start_time <> '24:00'),
  check (public.time_text_to_minutes(visible_start_time) < public.time_text_to_minutes(visible_end_time)),
  unique (user_id)
);

create index categories_user_id_idx on public.categories(user_id);
create index categories_user_sort_idx on public.categories(user_id, sort_order);
create index categories_user_deleted_idx on public.categories(user_id, deleted_at);

create index time_entries_user_date_idx on public.time_entries(user_id, date);
create index time_entries_user_category_idx on public.time_entries(user_id, category_id);
create index time_entries_user_updated_idx on public.time_entries(user_id, updated_at);

create index week_reviews_user_week_start_idx on public.week_reviews(user_id, week_start_date);

create index photo_references_user_date_idx on public.photo_references(user_id, date);
create index photo_references_user_entry_idx on public.photo_references(user_id, entry_id);

create index settings_user_id_idx on public.settings(user_id);

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger set_time_entries_updated_at
before update on public.time_entries
for each row execute function public.set_updated_at();

create trigger set_week_reviews_updated_at
before update on public.week_reviews
for each row execute function public.set_updated_at();

create trigger set_photo_references_updated_at
before update on public.photo_references
for each row execute function public.set_updated_at();

create trigger set_settings_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.time_entries enable row level security;
alter table public.week_reviews enable row level security;
alter table public.photo_references enable row level security;
alter table public.settings enable row level security;

create policy "Users can read own profile"
on public.user_profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "Users can insert own profile"
on public.user_profiles for insert
to authenticated
with check (id = (select auth.uid()));

create policy "Users can update own profile"
on public.user_profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Users can read own categories"
on public.categories for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can insert own categories"
on public.categories for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update own categories"
on public.categories for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can read own time entries"
on public.time_entries for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can insert own time entries"
on public.time_entries for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update own time entries"
on public.time_entries for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can read own week reviews"
on public.week_reviews for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can insert own week reviews"
on public.week_reviews for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update own week reviews"
on public.week_reviews for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can read own photo references"
on public.photo_references for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can insert own photo references"
on public.photo_references for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update own photo references"
on public.photo_references for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can read own settings"
on public.settings for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can insert own settings"
on public.settings for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update own settings"
on public.settings for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'thumbnailStorage',
  'thumbnailStorage',
  false,
  524288,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read own thumbnails"
on storage.objects for select
to authenticated
using (
  bucket_id = 'thumbnailStorage'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload own thumbnails"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'thumbnailStorage'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update own thumbnails"
on storage.objects for update
to authenticated
using (
  bucket_id = 'thumbnailStorage'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'thumbnailStorage'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete own thumbnails"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'thumbnailStorage'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
