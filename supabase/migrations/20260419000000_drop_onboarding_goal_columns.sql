-- Removed onboarding "goals" step; these columns are no longer written or read.
alter table public.profiles drop column if exists primary_goal;
alter table public.profiles drop column if exists daily_target;
