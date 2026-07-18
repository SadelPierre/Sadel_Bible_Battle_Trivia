# Setup Guide

A complete walkthrough from a blank computer to a running game.

## 1. Install Node.js

1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** installer (v20 or newer).
2. Run the installer with default options.
3. Open a terminal (PowerShell on Windows, Terminal on Mac) and check:
   ```bash
   node --version   # v20.x or newer
   npm --version
   ```

## 2. Install dependencies

In the project folder:

```bash
npm install
```

## 3. Run the game (offline modes)

```bash
npm run dev
```

Open http://localhost:3000. **Play Against Computer** and **Local Multiplayer** are fully playable right now — no database, no accounts.

## 4. Create a Supabase project (for online multiplayer)

1. Sign up free at [supabase.com](https://supabase.com).
2. Click **New project**, pick any name (e.g. `bible-battle-live`), set a database password, choose a region near your players, and create it.
3. Wait ~2 minutes for provisioning.

## 5. Run the database migration

1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Open the file `supabase/migrations/0001_init.sql` from this project, copy everything, paste it into the editor, and click **Run**.
3. You should see "Success. No rows returned". This creates all tables, security policies, and the realtime feed.

*(Alternative for CLI users: `npx supabase db push` with a linked project.)*

## 6. Set environment variables

1. Copy `.env.example` to a new file named `.env.local` (same folder).
2. In Supabase go to **Project Settings → API** and copy:

| Variable | Where to find it | Browser-safe? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | ✅ yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Publishable key** (`sb_publishable_…`) | ✅ yes (RLS blocks all sensitive access) |
| `SUPABASE_SECRET_KEY` | **Secret key** (`sb_secret_…`) | ❌ **NO — server only.** Never put it in client code, chat, or Git. |
| `NEXT_PUBLIC_APP_URL` | your site URL (`http://localhost:3000` in dev) | ✅ yes |

Legacy projects can instead use `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`; the modern publishable/secret keys are recommended.

3. Save the file. `.env.local` is git-ignored, so secrets never get committed.

## 7. Seed the Bible questions (optional)

The game plays from the built-in question bank automatically. To also load the questions into the `bible_questions` table (for admin tooling / future dynamic content):

```bash
npm run db:seed
```

## 8. Restart and play online

```bash
npm run dev
```

Open http://localhost:3000/online, create a room, and share the code. To test alone, open a second browser window in **incognito/private mode** (so it gets its own guest session) and join with the code.

## 9. Run the tests

```bash
npm test                         # unit + component tests
npx playwright install chromium  # once
npm run test:e2e                 # end-to-end browser tests
npm run lint && npm run typecheck
```

## 10. Production build

```bash
npm run build
npm start
```

Then see **DEPLOYMENT.md** to put it on the internet with Vercel.

## Troubleshooting

- **"Online play is not configured"** — `.env.local` is missing or incomplete; restart the dev server after editing it.
- **Room joins fail with "Room not found"** — the migration hasn't been run in the Supabase SQL editor, or the URL/key belong to a different project.
- **Lobby doesn't update instantly** — realtime is a nice-to-have; the game still syncs by polling every 2–4 s. Check that the migration's `alter publication supabase_realtime add table game_events` step succeeded (Database → Replication).
- **No sound** — browsers block audio until the first click/tap; press any button. Check the 🔊 mute toggle and the ⚙️ volume sliders.
