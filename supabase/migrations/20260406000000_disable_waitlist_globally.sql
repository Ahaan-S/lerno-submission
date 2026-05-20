alter table public.profiles
  add column if not exists is_waitlisted boolean not null default false;

alter table public.profiles
  alter column is_waitlisted set default false;

update public.profiles
set is_waitlisted = false
where is_waitlisted is distinct from false;
