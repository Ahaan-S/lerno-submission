alter table public.profiles
  add column if not exists is_waitlisted boolean not null default true;

update public.profiles
set is_waitlisted = false
where trim(coalesce(grade, '')) in ('10', 'Class 10');
