-- =====================================================================
-- Helpdesk — Supabase database setup
--
-- Builds everything the app needs on a NEW Supabase project:
-- tables, grants, Row Level Security policies, the agent role,
-- the private screenshot bucket, and Realtime.
--
-- How to use:
--   1. Open your Supabase project → SQL Editor → New query
--   2. Paste this whole file and click Run (once)
--   3. Click "Run query" if Supabase warns about destructive operations
--      (the script uses `revoke`, which triggers the warning)
--
-- Security model in one sentence:
--   Grants decide whether a role can touch a table at all ("lock 1");
--   RLS policies decide which rows it can see or change ("lock 2").
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TICKETS
-- ---------------------------------------------------------------------

create table tickets (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users default auth.uid(),
  title text not null,
  description text,
  status text default 'open',
  created_at timestamptz default now()
);

alter table tickets enable row level security;

-- Lock 1: logged-out visitors get nothing; logged-in users can read and
-- create tickets, and may only ever update the `status` column.
revoke all on table tickets from anon, authenticated;
grant select, insert on table tickets to authenticated;
grant update (status) on table tickets to authenticated;

-- Lock 2: customers see and create only their own tickets.
create policy "Users can read their own tickets"
on tickets for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own tickets"
on tickets for insert
to authenticated
with check (auth.uid() = user_id);

-- Policies check user_id on every row, so index it.
create index tickets_user_id_idx on tickets (user_id);


-- ---------------------------------------------------------------------
-- 2. MESSAGES (replies on a ticket, optionally with a screenshot)
-- ---------------------------------------------------------------------

create table messages (
  id bigint generated always as identity primary key,
  ticket_id bigint references tickets (id) on delete cascade not null,
  user_id uuid references auth.users default auth.uid(),
  body text not null,
  attachment_path text,
  created_at timestamptz default now()
);

alter table messages enable row level security;

revoke all on table messages from anon, authenticated;
grant select, insert on table messages to authenticated;

-- You can read replies on tickets you own.
create policy "Users can read messages on their own tickets"
on messages for select
to authenticated
using (
  exists (
    select 1 from tickets
    where tickets.id = messages.ticket_id
      and tickets.user_id = auth.uid()
  )
);

-- You can only reply on tickets you own, and only as yourself.
create policy "Users can reply on their own tickets"
on messages for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from tickets
    where tickets.id = messages.ticket_id
      and tickets.user_id = auth.uid()
  )
);

create index messages_ticket_id_idx on messages (ticket_id);


-- ---------------------------------------------------------------------
-- 3. ROLES: customers and support agents
-- ---------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'agent'))
);

alter table profiles enable row level security;

revoke all on table profiles from anon, authenticated;
grant select on table profiles to authenticated;

-- You can read your own profile (so the app knows if you're an agent).
-- There is deliberately NO update policy: nobody can promote themselves.
-- Roles are changed only by an admin (see the end of this file).
create policy "Users can read their own profile"
on profiles for select
to authenticated
using (id = auth.uid());

-- Give every new user a 'customer' profile automatically on sign-up.
-- (If this trigger ever fails, sign-ups fail with
--  "Database error saving new user".)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Create profiles for any users that already existed before this script.
insert into profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- Helper used inside policies: "is the logged-in user an agent?"
-- `security definer` lets it read profiles even though users can
-- only read their own profile row.
create function public.is_agent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'agent'
  );
$$;


-- ---------------------------------------------------------------------
-- 4. AGENT PERMISSIONS
-- Policies for the same action combine with OR: a row is allowed if
-- ANY policy allows it. These add to the customer rules above.
-- ---------------------------------------------------------------------

create policy "Agents can read all tickets"
on tickets for select
to authenticated
using (public.is_agent());

create policy "Agents can update tickets"
on tickets for update
to authenticated
using (public.is_agent())
with check (public.is_agent());

create policy "Agents can read all messages"
on messages for select
to authenticated
using (public.is_agent());

create policy "Agents can reply on any ticket"
on messages for insert
to authenticated
with check (user_id = auth.uid() and public.is_agent());


-- ---------------------------------------------------------------------
-- 5. STORAGE: private bucket for screenshots
-- Files are saved as  <user-id>/<ticket-id>/<timestamp>-<filename>
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,                                   -- private: viewing needs a signed URL
  5242880,                                 -- 5 MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
);

-- Upload only into your own folder (first folder = your user id).
create policy "Users can upload to their own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- View files in your own folder.
create policy "Users can view their own files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Customers can view any file on their own tickets
-- (second folder = ticket id), e.g. screenshots an agent sent them.
create policy "Customers can view attachments on their tickets"
on storage.objects for select
to authenticated
using (
  bucket_id = 'attachments'
  and exists (
    select 1 from public.tickets
    where tickets.id::text = (storage.foldername(name))[2]
      and tickets.user_id = auth.uid()
  )
);

-- Agents can view every attachment.
create policy "Agents can view all attachments"
on storage.objects for select
to authenticated
using (bucket_id = 'attachments' and public.is_agent());


-- ---------------------------------------------------------------------
-- 6. REALTIME
-- Broadcast changes on these tables to the app. Realtime respects RLS,
-- so each user only receives changes to rows they're allowed to see.
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table tickets;
alter publication supabase_realtime add table messages;


-- =====================================================================
-- AFTER RUNNING THIS FILE: make yourself a support agent
--
-- Sign up in the app first, then run this separately
-- (replace the email with yours):
--
--   update profiles
--   set role = 'agent'
--   where id = (select id from auth.users where email = 'you@example.com');
--
-- Check everyone's roles:
--
--   select u.email, p.role
--   from profiles p
--   join auth.users u on u.id = p.id;
-- =====================================================================
