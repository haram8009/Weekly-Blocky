create unique index if not exists categories_user_active_name_unique_idx
on public.categories (user_id, lower(name))
where deleted_at is null;
