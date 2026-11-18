# Helpdesk — a support ticket app built with Supabase

**Live demo:** https://helpdesk-app-ten-kappa.vercel.app

A small customer support helpdesk where customers submit tickets, attach screenshots, and chat with support agents in real time. I built it to learn Supabase from the ground up, and to understand the kinds of problems developers run into when they use it.

> **Demo accounts**
> - Customer: `TEST1234@TEST.COM` / `TESTTEST`
> - Support agent: `AGENT@TEST.COM` / `TESTTEST`
>
> Try logging in as each one in separate windows (one normal, one Incognito) to see how the same app shows different data to different users.

---

## What it does

**Customers can:**
- Sign up and log in
- Create support tickets
- Reply on their tickets and attach screenshots
- See replies and status changes from support appear live, without refreshing
- Only ever see their own tickets

**Support agents can:**
- See every customer's tickets
- Reply to any ticket (replies are labeled "Support")
- Change a ticket's status: open → in progress → closed

---

## Built with

| Part | Tool |
|---|---|
| Frontend | React + Vite |
| Database | Supabase Postgres |
| Login | Supabase Auth (email + password) |
| Security | Postgres Row Level Security (RLS) |
| Live updates | Supabase Realtime |
| File uploads | Supabase Storage (private bucket + signed URLs) |
| Hosting | Vercel |

---

## How the security works

The most important thing I learned building this: **the security lives in the database, not in the React code.**

My app asks for tickets the same way no matter who's logged in:

```js
supabase.from('tickets').select('*')
```

That says "give me all the tickets." The database then checks its Row Level Security policies and decides which rows each person actually gets:

```
Customer asks for all tickets ──► policies ──► only THEIR tickets
Agent asks for all tickets    ──► policies ──► EVERY ticket
```

Because the rules are in Postgres, someone can't get around them by opening the browser's developer tools and sending their own requests. The database always checks.

**Key pieces:**
- **Two locks on every table:** a `GRANT` decides whether a role can touch the table at all, and RLS policies decide which rows. ("Permission denied" = missing grant. Empty results with no error = usually RLS.)
- **Ownership policies:** customers can only read and create tickets and replies where `user_id = auth.uid()`.
- **Roles:** a `profiles` table stores each user's role (`customer` or `agent`). A trigger creates a profile automatically on sign-up, and a `security definer` function, `is_agent()`, is used inside policies.
- **No one can promote themselves:** there's no update policy on `profiles`, so roles can only be changed by an admin in the dashboard.
- **Least privilege:** agents can update only the `status` column on tickets (`grant update (status)`), and logged-out visitors can't read tickets at all.
- **Private file storage:** screenshots go in a private bucket, organized as `user-id/ticket-id/file`. Storage policies check the folder names to decide who can upload and view, and the app shows images using temporary signed URLs.

---

## Database

```
auth.users (managed by Supabase)
   │
   ├── profiles   (id, role)
   │
   └── tickets    (id, user_id, title, description, status, created_at)
          │
          └── messages  (id, ticket_id, user_id, body, attachment_path, created_at)

storage: attachments bucket (private, images only, 5 MB max)
```

---

## What I learned

I kept a debugging journal the whole time, covering every error I hit, what I first thought was wrong, what was actually wrong, and how I'd help someone else with the same problem. It's in [`DEBUGGING.md`](./DEBUGGING.md).

A few highlights:
- **"Invalid API key"** — my key got cut off when I copied it.
- **"permission denied for table"** vs. **empty results** — two different problems (missing grant vs. RLS).
- **"Failed to fetch"** after a week away — free-plan projects pause when inactive.
- **The SQL Editor bypasses RLS** — so you have to test policies through the app as a real user.
- **Realtime needs the table added to the `supabase_realtime` publication**, and it respects RLS.
- **"Success" but nothing changed** — when RLS blocks an update, there's no error, just zero rows. I added `.select()` to updates so the app can tell.

---

## Running it locally

1. Clone the repo and install packages:
   ```bash
   git clone https://github.com/Oakevinlee/helpdesk-app.git
   cd helpdesk-app
   npm install
   ```
2. Create a free project at [supabase.com](https://supabase.com).
3. Copy `.env.example` to `.env` and fill in your project's URL and publishable key (Project Settings → API Keys):
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_PUBLISHABLE_KEY=
   ```
4. Run the SQL setup in the Supabase SQL Editor (tables, policies, storage bucket, and agent role).
5. Start the app:
   ```bash
   npm run dev
   ```
6. To make an agent, sign up in the app, then run:
   ```sql
   update profiles set role = 'agent'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

---

## What I'd add next

- Separate databases for local development and production
- Email notifications when support replies (Supabase Edge Functions)
- Search and filtering for agents

---

Built by Kevin Lee