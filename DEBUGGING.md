# Debugging Journal

## Vite wouldn't install — Nov 3, 2026

**Error:** `SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'`

**What happened:** I ran `npm create vite@latest` and got a wall of code and an error.

**What I thought at first:** That something was wrong with npm, so I tried updating npm. That failed too. Did this mamy times --for science.

**Actual cause:** My Node version was way too old (v18). The newest Vite needs Node 20.19+. The warning was right there at the top (`EBADENGINE`), I just didn't know what it meant yet because its been a looong time since i've coded.

**Fix:** Installed nvm and used it to install a current version of Node.

**What I learned:** Read the first warning, not just the last error. And check `node -v` first when a tool won't install.

---

## "Invalid API key" — Nov 3, 2026

**Error:** `Something went wrong: Invalid API key`

**What happened:** My app connected to Supabase, but Supabase rejected the key.

**What I thought at first:** That I'd copied the wrong key.

**Actual cause:** The key was cut off when I copied it from the Connect panel, because it ran off the edge of the box.

**Fix:** Copied it again with the copy button in Project Settings -> API Keys, then restarted `npm run dev` (Vite only reads `.env` on startup).

**What I learned:** Use the copy button for keys, and always restart the dev server after changing `.env`.

---

## "permission denied for table tickets" — Nov 3, 2026

**Error:** `permission denied for table tickets`

**What happened:** After fixing the key, I got a new error instead of my tickets.

**What I thought at first:** I thought it was a Row Level Security problem since I'd just set that up.

**Actual cause:** It wasn't RLS. The `anon` role didn't have permission to read the table at all. RLS controls *which rows* you see; grants control whether you can touch the table in the first place.

**Fix:** Ran `grant select on table tickets to anon, authenticated;` in the SQL Editor.

**What I learned:** "Permission denied" = missing grant. Empty results with no error = usually RLS.

** Claude helped ALOT.

## What I learned about Supabase Storage — Nov 17, 2026

I added screenshot uploads to my helpdesk tonight. The upload part was
pretty straightforward, but the security side is where it got interesting.
Three things clicked for me:

### 1. Public vs. private buckets

Storage is organized into buckets. A **public** bucket means anyone with
the link can see the file, no login needed. That's fine for stuff like
product photos or a logo. A **private** bucket means you need permission
to view anything in it.

I made my `attachments` bucket private because people upload screenshots
of their problems, and screenshots can have personal info in them
(emails, account details, billing pages). If I'd made it public, anyone
who got hold of a link could see someone else's screenshot.

### 2. Why private files need signed URLs

Since the bucket is private, I can't just drop a normal link into an
`<img>` tag. It won't load. Instead, my app asks Supabase for a
**signed URL**, which is a temporary link that only works for a set
amount of time (I used one hour).

The way I think about it: a public link is like leaving the door open.
A signed URL is like handing someone a key that stops working after an
hour. Even if the link gets shared, it expires.

### 3. How Storage policies use folder names

This was the part I liked most. Storage uses the same Row Level Security
I already set up for my tables. I save every file in a folder named after
the user's ID, like `user-id/ticket-id/screenshot.png`. Then my policy
just checks: "does the first folder in this path match the person who's
logged in?" If yes, they can upload or view it. If no, they're blocked.

So the folder structure isn't just for organizing. It's how the security
works. If I'd saved files with random names and no user folder, the
policy would have nothing to check against.

**Takeaway:** If someone asks "why can't I see my image?" or "why is my
upload failing with an RLS error?", the first things I'd check are:
is the bucket private, are they using a signed URL, and does the file
path start with their user ID?

## "Success" but nothing changed — Nov 17, 2026

**What happened:** While building the agent role, I learned that when
Row Level Security blocks an update or delete, Supabase doesn't throw an
error. It just updates nothing and acts like everything went fine. Zero
rows changed, no warning.

**Why that's sneaky:** If you're only checking for errors, you'd think it
worked. A customer would click "save," see no error, and then wonder why
nothing changed. Honestly, if I hadn't been told about this, I would have
spent a long time staring at my code thinking it was broken.

**How I handled it:** I added `.select()` to the end of my update so
Supabase sends back the rows it actually changed. If that comes back
empty, I know RLS blocked it, and I show a clear message instead of
pretending it worked.

**Takeaway:** If someone writes in saying "my update says success but
nothing changed," my first question is whether RLS is blocking it. Check
the policies, and check whether the update returns any rows.

---

## Milestone: the helpdesk is feature-complete — Nov 17, 2026

As of tonight my app has everything I set out to build:
- A Postgres database with tickets and replies
- Sign up and login with Supabase Auth
- Row Level Security so customers only see their own stuff
- Live replies with Realtime
- Screenshot uploads with Storage
- A support agent role that can see every ticket and change its status

Next up is polish: making it look decent, putting it online so other
people can use it, and writing a README that explains what I built.