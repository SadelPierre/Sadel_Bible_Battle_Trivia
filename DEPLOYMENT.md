# Deployment (Vercel)

## Prerequisites

- The app runs locally (`npm run build` succeeds).
- A Supabase project with the migration applied (see SETUP.md §4–5) if you want online multiplayer.
- The project pushed to a GitHub/GitLab/Bitbucket repository (recommended), or the Vercel CLI.

## Deploy via the Vercel dashboard (recommended)

1. Push this folder to a Git repository:
   ```bash
   git init
   git add .
   git commit -m "Bible Battle Live"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo. Vercel auto-detects Next.js; keep the defaults.
3. Before the first deploy, open **Environment Variables** and add:

   | Name | Value | Environments |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL | all |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key | all |
   | `SUPABASE_SECRET_KEY` | secret key (**server-only**) | all |
   | `NEXT_PUBLIC_APP_URL` | `https://<your-app>.vercel.app` | production |

4. Click **Deploy**. Done — share `https://<your-app>.vercel.app`.

You can skip the Supabase variables entirely if you only need solo/local play; the online screens will explain they're not configured.

## Deploy via CLI

```bash
npm i -g vercel
vercel            # first deploy, answer the prompts
vercel env add NEXT_PUBLIC_SUPABASE_URL   # …repeat for each variable
vercel --prod
```

## After deploying

- Set `NEXT_PUBLIC_APP_URL` to the final URL (it powers invite links) and redeploy.
- Test: create a room on your phone, join from a laptop.
- Custom domain: Vercel → Settings → Domains.

## Notes & gotchas

- **Never** expose `SUPABASE_SECRET_KEY` (or the legacy service-role key) with a `NEXT_PUBLIC_` prefix.
- Online play uses request/response + Supabase Realtime (no server WebSockets), so it works on Vercel's serverless platform without extra configuration.
- The in-memory rate limiter is per serverless instance; for strict limits add Upstash Redis and swap the implementation in `src/lib/rateLimit.ts`.
- Supabase free tier pauses inactive projects after a week of no traffic — open the dashboard to wake it, or upgrade for always-on.
