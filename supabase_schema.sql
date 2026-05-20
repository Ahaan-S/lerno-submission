-- Clean up existing objects to avoid conflicts
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.profiles cascade;

-- Create a customized profiles table
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  first_name text,
  last_name text,
  grade text,
  selected_subjects text[], -- Step 2: Subjects selected by user
  strong_subjects text[],   -- Onboarding: subjects marked strong (whole subject)
  weak_subjects text[],     -- Onboarding: subjects marked weak (whole subject)
  topic_strengths jsonb,  -- Onboarding: granular topic strengths
  topic_weaknesses jsonb, -- Onboarding: granular topic weaknesses
  learning_style text[],  -- Onboarding: learning style
  additional_info text,   -- Onboarding: free text
  avatar_url text,
  onboarding_completed boolean default false,
  updated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Turn on Row Level Security (Security best practice)
alter table profiles enable row level security;

-- Policy: Users can view their own profile
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

-- Policy: Users can update their own profile
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Policy: Users can insert their own profile
create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- Trigger: Automatically create a profile entry when a new user signs up via Auth
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
