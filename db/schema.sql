-- Create a table for public profiles using Supabase authentication.
create type access_status as enum ('waitlist', 'granted', 'admin', 'rejected');

create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  
  -- Waitlist & Access Control
  access_status access_status default 'waitlist'::access_status,
  
  -- Core Onboarding Status
  onboarding_completed boolean default false,
  
  -- Basic Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Secure the table with Row Level Security (RLS)
alter table profiles enable row level security;

-- Policies for Profiles
-- 1. Users can view their own profile.
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

-- 2. Users can update their own profile.
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Function to handle new user signup
-- This trigger automatically creates a profile entry when a new user signs up via Auth.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Optional: Storage for User Content (Avatars, etc.)
-- insert into storage.buckets (id, name) values ('avatars', 'avatars');
-- create policy "Avatar images are publicly accessible." on storage.objects for select using ( bucket_id = 'avatars' );
-- create policy "Anyone can upload an avatar." on storage.objects for insert with check ( bucket_id = 'avatars' );

