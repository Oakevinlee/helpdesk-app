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