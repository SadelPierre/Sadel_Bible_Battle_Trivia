# 📖 Bible Battle Live

Fast, joyful, family-friendly Bible trivia for churches, Sabbath School groups, youth groups, families, and game nights. Play solo against computer opponents, with 2–4 people on one device, or online with friends in private rooms.

Built with Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, Zustand, Zod, and Supabase (Postgres + Realtime) with **server-authoritative** online play.

> Renaming the game? Everything brand-related (name, tagline, logo) lives in
> `src/lib/branding.ts`; colors/themes live in `src/app/globals.css` + `src/lib/themes.ts`.

## Features

- 🤖 **Solo vs computer** — 1–3 bots with Easy / Medium / Hard difficulty, human-like think times and believable mistakes
- 🛋️ **Local multiplayer** — 2–4 players on one device: shared-screen race (with per-player keyboard keys) or pass-and-play with private turns
- 🌍 **Online multiplayer** — private rooms with 5-letter codes and invite links, real-time lobby, host controls, bots in empty seats, reconnect support, rematch
- 📚 **150 reviewed questions** across 15 categories (Old/New Testament, Life of Jesus, Parables, Miracles, Who Said It?, Finish the Verse, …) with Bible reference and explanation after every question
- ⏱️ Synchronized timers, answer locking, speed & streak bonus scoring, fair tie-breakers
- 🎉 Animations, confetti, synthesized sound effects & optional music (all replaceable), reduced-motion support, keyboard navigation, screen-reader labels

## Quick start (5 minutes, no database needed)

Solo and local multiplayer work with **zero configuration**:

1. **Install Node.js** — download the LTS version from [nodejs.org](https://nodejs.org) (v20+). Verify with `node --version`.
2. **Install dependencies** — in this folder run:
   ```bash
   npm install
   ```
3. **Start the dev server**:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) and play!

## Enabling online multiplayer (Supabase)

1. Create a free project at [supabase.com](https://supabase.com) → New project.
2. In the Supabase dashboard open **SQL Editor**, paste the contents of
   `supabase/migrations/0001_init.sql`, and run it.
3. Copy `.env.example` to `.env.local` and fill in (Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL` — the Project URL *(safe for the browser)*
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the publishable key *(safe for the browser; RLS locks it down)*
   - `SUPABASE_SECRET_KEY` — the secret key *(SERVER ONLY — never expose or commit)*
   - `NEXT_PUBLIC_APP_URL` — e.g. `http://localhost:3000` (used in invite links)
4. *(Optional)* seed the question table for admin tooling:
   ```bash
   npm run db:seed
   ```
5. Restart `npm run dev`. The Online Multiplayer screen is now live.

See **SETUP.md** for a beginner-friendly walkthrough with screenshots-level detail, and **DEPLOYMENT.md** for deploying to Vercel.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | start the development server |
| `npm run build` | production build |
| `npm start` | run the production build |
| `npm test` | unit + component tests (Vitest) |
| `npm run test:e2e` | end-to-end tests (Playwright; run `npx playwright install chromium` once first) |
| `npm run lint` / `npm run typecheck` | ESLint / strict TypeScript |
| `npm run questions:admin -- <cmd>` | question admin CLI (validate, list, preview, import, export, stats) |
| `npm run db:seed` | upsert the question bank into Supabase |

## Replacing sounds, logos, and branding

- **Name / tagline / logo** — edit `src/lib/branding.ts`. To use an image logo, put it in `public/images/` and set `logoImage`.
- **Sounds** — all cues are synthesized with the Web Audio API, so no files are required. To use real recordings, drop files in `public/audio/` and register them at startup, e.g. `audio.registerFile("correct", "/audio/correct.mp3")` (see `src/features/audio/audio.ts` for the full cue list: click, playerJoined, gameStart, countdownTick, countdownGo, timerWarning, correct, incorrect, scoreTick, rankUp, roundComplete, winner). Use royalty-free or original audio.
- **Colors / themes** — the default *Royal Bible* theme is defined in `src/app/globals.css`; register new themes (Desert Journey, Garden of Eden, Light of the World, Youth Night) in `src/lib/themes.ts` and add a matching `[data-theme="…"]` CSS block.

## Documentation

| File | Contents |
| --- | --- |
| `SETUP.md` | step-by-step local + Supabase setup |
| `GAME_RULES.md` | full game rules, scoring, tie-breakers |
| `ARCHITECTURE.md` | WAT framework, engine design, online authority model |
| `DATABASE.md` | schema, RLS policy rationale |
| `QUESTION_FORMAT.md` | question schema + admin workflow |
| `DEPLOYMENT.md` | Vercel deployment guide |
| `TESTING.md` | test suites and how to run them |

## Known limitations

- Online play requires Supabase environment variables on the Next.js server. Without them the online screens explain what to configure; solo/local play is unaffected.
- Rate limiting is in-memory (per serverless instance) — swap in Upstash/Redis for strict global limits.
- Optional player accounts/statistics are schema-ready (`profiles`, `player_statistics`) but not yet surfaced in the UI; guests are fully supported.
