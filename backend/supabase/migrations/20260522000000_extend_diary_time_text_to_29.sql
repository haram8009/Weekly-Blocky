create or replace function public.time_text_to_minutes(time_text text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when time_text ~ '^([01][0-9]|2[0-8]):[0-5][0-9]$' or time_text = '29:00'
      then split_part(time_text, ':', 1)::integer * 60 + split_part(time_text, ':', 2)::integer
    else null
  end
$$;
