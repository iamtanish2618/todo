# Todo

A penguin companion for focus, notes, and a little help. This is the first working version, built around the full-screen character and frosted shadcn interface we designed together.

## Start here

- **Your account:** Google and email/password login are implemented behind a Firebase provider setting, with verification, password reset, remembered sign-in and protected API sessions. The Todo Firebase project and authorized domains are connected. The public homepage needs no ChatGPT account; see [the account setup guide](docs/AUTH.md). Firebase is the default and does not fall back to ChatGPT identity. The shadcn form includes the small penguin that follows field focus and celebrates account/profile setup.
- **One shared workspace:** the single **Focus with Todo** invitation enters the room, with your selected penguin sitting across the desk, a notebook and pen, coffee with rising steam, and a physical-looking live clock. Companion and Agent are modes in this room; closing a tool leaves the room in place.
- **Focus solo:** write your tasks, select up to three, then start using the physical desk clock. Todo writes while you focus and has coffee during breaks. Timer settings let you choose 1–120 minutes, pause, resume, and save progress. The timer continues when you close a tool or refresh.
- **Ask Todo:** chat, make notes, summarize text, or ask about an image once an AI provider is connected. Attach `.txt`, `.md`, PNG, JPEG, or WebP files. Image input needs a vision-capable model.
- **Your notes:** write and save notes and download real multi-page PDFs. This works without AI.
- **Choose your companion:** scroll between the penguins or click the switch hint. Each character has its own invitation and greeting. They fade away as he closes his eyes and snow fills the screen, then return as she opens hers. The original playful avatar wears separate blue/pink knitted cap and muffler layers. The story now takes one long scroll, with him moving up and her arriving from below. Clicking anywhere on them triggers gentle wiggles, bounces, warmer blush, and occasional little hearts. Clicks do not blink. Your choice is remembered.
- **Ambience:** switch day/night window light, add rain outside, and choose optional quiet day/night melodies or rain audio. Sounds start only after your choice.
- **Settings:** turn on sound effects or gentler motion.

See [the room guide](docs/ROOM.md) for desktop layout, poses, tasks, ambience, notes, agent limits, and tuning. Phone design is on hold.

Friends, microphone chat, and synchronized rooms are the next stage. The Friends panel says this explicitly. Games are on hold: there is no race or other game in this version. Breaks are simple rest periods; game ideas will be revisited later.

## The process, in plain language

1. **Frontend:** what you see and click. React displays the penguin, and shadcn supplies accessible buttons, dialogs, inputs, tabs, checkboxes, and switches.
2. **Animation:** one GSAP scroll timeline takes you through a blink and snowfall wipe. Lenis, cursor-tracking pupils, cursor sway, background refraction, click reactions, idle blinks, breathing, and the snow canvas share one ticker. The image exchange happens behind a fully opaque veil. Gentler motion uses a quiet crossfade. See [the introduction guide](docs/INTRO.md) for artwork, timing controls, and the `?debug=1` panel.
3. **Backend:** a private part of the website receives requests. It checks who is signed in and validates the request before saving anything or asking the AI.
4. **Database:** Cloudflare D1 keeps your preferred name, tasks, notes, and focus history, with every query restricted to the signed-in owner. Device preferences and the active timer use versioned local storage.
5. **AI API:** our backend sends a message to an existing model and returns its reply. We do not train our own model. The API key stays on the server. The model can read submitted text and, when enabled, images; it cannot operate other apps or browse the web.
6. **PDF export:** our code formats your text into a downloadable PDF. No AI call is needed to create the file. The current font supports Latin, Greek, and Cyrillic text; unsupported characters produce a clear error rather than silently disappearing.
7. **Tests and hosting:** Playwright checks real browser actions and API routes. Sites builds and hosts the public app with private account data and provisions the database.

## Run locally

Requires Node.js 22.13 or later.

```sh
npm install
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_steady_lenny_balinger.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_freezing_cloak.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_square_master_chief.sql
npm run dev -- --port 3000
```

Open the printed local URL. Firebase is the default locally and in production. The starter can explicitly use a legacy mock account on loopback for tests; it is never a production authentication fallback. Local and hosted databases are separate. Apply a local SQL migration only once; new schema changes need a new migration.

## Connect AI privately

The initial build does **not** have live AI credentials. It clearly displays that state. Focus, notes, and PDF export already work.

Choose an OpenAI-compatible API provider with terms allowing the account owner, intended age group, and this app's use. Free tiers have quotas and may have different data rules. Gemini API is not suitable here because its current terms exclude API clients likely to be accessed by under-18s. A parent's account does not remove that app restriction. Do not paste API keys into chats or commit them.

For local development copy `.env.example` to `.env.local`, fill these private values, and restart the dev server:

```text
TODO_AI_API_KEY=<your private key>
TODO_AI_BASE_URL=<provider's HTTPS API base URL ending in /v1>
TODO_AI_MODEL=<provider's exact current model ID>
TODO_AI_LABEL=<friendly provider name>
TODO_AI_VISION=true
TODO_AI_DAILY_LIMIT=25
```

Enable vision only for models supporting image inputs. For hosting, set these with the Sites environment-variable tool; the local file is not deployed. Never use a `NEXT_PUBLIC_` prefix for secrets. No API key entry exists in the public UI.

The server caps messages and uploads, limits output, times out after 45 seconds, makes no automatic retries, and reserves at most 25 requests per user per UTC day by default. Provider failures can still consume a reserved request. There is no subscription or paid tier in the app. An API free tier does not guarantee zero hosting or provider cost forever.

## Validation

```sh
npm run typecheck
npx playwright install chromium
# Keep the dev server on port 3000 running:
npm run test:e2e
npm run build
```

Tests cover pointer tracking, glass hover, scroll selection and reload persistence, task CRUD, timer pause/resume and history, note persistence, a real multi-page PDF download, uploads, unavailable-AI errors and draft preservation, anonymous/forged-identity rejection, cross-origin rejection, input validation, reduced motion, settings, and the existing homepage portrait controls. Dedicated phone room work is deferred. Additional checks verify hidden image swaps, identical reverse timeline states, fast scrolling, resized eye registration, live timing controls, portrait eye visibility, a stationary room across repeated panel changes, shared timers, and aborting pending chat when its panel closes. Mocked provider tests verify image/text transport and failure handling; a mocked browser reply verifies saving an AI answer as a note. They do not claim that a live provider or model quality has been tested.

## Files to change

- `components/todo/todo-app.tsx`: screen choices and focus, notes, AI, history, and settings panels.
- `components/todo/welcome.tsx`: first-page configuration, eyes, single scroll timeline, snowfall, character choices, and live tuning.
- `components/todo/welcome.css`: first-page layout, glass materials, accessories, and portrait framing.
- `components/todo/study-room.tsx`: the shared desk scene, companion animation, live clock, and tool dock.
- `app/globals.css`: typography, glass materials, spacing, transitions, and responsive layouts.
- `app/api/`: authenticated tasks, notes, sessions, status, and assistant endpoints.
- `lib/todo/ai.ts`: model connection and assistant instructions.
- `lib/todo/client.ts`: browser requests and PDF generation.
- `db/schema.ts` and `drizzle/`: database schema and versioned SQL migrations.
- `tests/`: repeatable browser, API, and mocked model tests.

Artwork was generated using the built-in ImageGen tool. The clean background is at `public/art/todo-face.png`; the eyes and interface are separate working elements. Noto Sans is bundled with its license in `public/fonts/`.
