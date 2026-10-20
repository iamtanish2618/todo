# Todo

A penguin companion for focus, notes, and a little help. This is the first working version, built around the full-screen character and frosted shadcn interface we designed together.

## Start here

- **Your account:** Google and email/password login are implemented behind a Firebase provider setting, with verification, password reset, remembered sign-in and protected API sessions. The Todo Firebase project and authorized domains are connected. The public homepage needs no ChatGPT account; see [the account setup guide](docs/AUTH.md). Firebase is the default and does not fall back to ChatGPT identity. The shadcn form includes the small penguin that follows field focus and celebrates account/profile setup.
- **One shared workspace:** the single **Focus with Todo** invitation enters the room, with your selected penguin sitting across a complete round wooden table, a notebook and pen, coffee with rising steam, and a raised circular timer with depth, feet and a contact shadow. The notebook has curved pages and real page thickness. Todo’s attached flippers write during focus and lift a mug during breaks; the lamp starts off and warms up automatically for focus, without a reaching hand. Companion and Agent are modes in this room; closing a tool leaves the room in place.
- **Focus solo:** write your tasks, select up to three, then start using the physical desk clock. Todo writes while you focus and has coffee during breaks. The physical clock handles pause, resume and finishing. Clicking the clock opens a compact setup with custom 1–120 minute durations and a Focus button. Selecting tasks darkens them without crossing them out. Focus hides the tools, warms the lamp and gently zooms toward Todo preparing his notebook and writing. Click the clock or press Escape to pause and restore controls. The old adjustment crown and duplicate timer display are removed. The timer continues when you close a tool or refresh.
- **A little celebration:** completing a task or focus sit brings up Todo cheering, with only **Take a break** and **Continue focusing**. The soft two-note chime follows the room sound-effects setting. Breaks accept a custom 1–120 minutes, hide the tools, and show Todo sipping coffee. **Focus again** returns to the front page; **End break** restores the room. Break time never counts as focused time.
- **Ask Todo:** Agent mode fades ordinary tools away, gently zooms in, and replaces the lower invitation with one chat composer. Type, attach text/images, or use browser dictation and review before sending. Enter sends; Shift+Enter adds a line. Back to room or Escape restores the workspace. Live replies require a privately configured model; notes/PDF export remain available for answers.
- **Tasks:** active tasks stay saved until explicitly deleted. Finished tasks have their own panel with accumulated recorded focus time, linked by task ID so equal names cannot mix. Earlier untimed tasks say Not timed. A quiet focus sit can also start directly from the clock without a task.
- **Your notes:** write and save notes and download real multi-page PDFs. This works without AI.
- **Choose your companion:** scroll between the penguins or click the switch hint. Each character has its own invitation and greeting. They fade away as he closes his eyes and snow fills the screen, then return as she opens hers. The original playful avatar wears separate blue/pink knitted cap and muffler layers. The story now takes one long scroll, with him moving up and her arriving from below. Clicking anywhere on them triggers gentle wiggles, bounces, warmer blush, and occasional little hearts. Clicks do not blink. Your choice is remembered.
- **Ambience:** choose Day, Night, or Rain. Rain shows an overcast evening and starts no audio. Independently choose Sound off, White noise, Brown noise, or Rainy noise. The three exact user-selected recordings play in a visible YouTube player that stays available during focus. Weather changes preserve the recording; Stop sound or leaving the room stops playback. There is no volume slider or separate rain toggle. All room tools share the same glass transparency.
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

Gemini is configured privately for the adult-audience version. The owner supplies the key through ignored local/server configuration; no key is included in source or the browser bundle. Focus, notes and PDF export also work independently of AI.

Todo's intended audience is adults aged 18+ (confirmed by the owner). Gemini can be connected through its OpenAI-compatible endpoint using an eligible adult-owned account. Free tiers have quotas and different data rules; unpaid Gemini inputs/outputs can be used by Google to improve its products. Do not paste API keys into chats or commit them. See [the Gemini setup guide](docs/AI.md).

For local development copy `.env.example` to `.env.local`, fill these private values, and restart the dev server:

```text
TODO_AI_API_KEY=<your private key>
TODO_AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
TODO_AI_MODEL=gemini-3.6-flash
TODO_AI_LABEL=Gemini
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
- `components/todo/study-room.tsx`: the shared room flow, tasks and tool panels.
- `components/todo/room/scene.tsx` and `scene.css`: fixed-camera round table, lamp light and dimensional timer.
- `components/todo/room/flippers.tsx`, `notebook.tsx`, `window.tsx`, `calm.css`: attached writing/sipping motions, curved notebook pages, morning sky and slow rain.
- `app/globals.css`: typography, glass materials, spacing, transitions, and responsive layouts.
- `app/api/`: authenticated tasks, notes, sessions, status, and assistant endpoints.
- `lib/todo/ai.ts`: model connection and assistant instructions.
- `lib/todo/client.ts`: browser requests and PDF generation.
- `db/schema.ts` and `drizzle/`: database schema and versioned SQL migrations.
- `tests/`: repeatable browser, API, and mocked model tests.

Artwork was generated using the built-in ImageGen tool. The clean background is at `public/art/todo-face.png`; the eyes and interface are separate working elements. Noto Sans is bundled with its license in `public/fonts/`.

## Break-over reminder

Natural break expiry speaks “The break is over. We need to focus once again.” using the browser’s English voice at a gently raised pitch. The same message stays visible if speech is unavailable or blocked. Todo sweeps diagonally across a warm full-screen wipe, then reveals the normal room controls without starting another timer or recording a focus session. Ambient playback pauses during the reminder. “Back to focus” skips the announcement; reduced motion uses a short dissolve instead. Voice availability and pronunciation depend on the device.

`components/todo/room/break-return.tsx` owns the announcement, cancellation and covered scene swap. Its CSS controls the greeting and oversized penguin. `tests/break-return.spec.ts` checks natural expiry, voice failure fallback, cancellation, and preservation of focus history using disposable local timer fixtures.

## Cinematic room polish

The room now has a dark bokeh/wordmark entry, a window-centred reveal and 1.2-second camera settle, a sleeping/waking Todo, layered pointer depth, breathing lamp bloom, window light, grain and bounded canvas atmosphere. The lamp, teapot, notebook, window, plants, picture, rug and string lights have discoverable hover and keyboard cues. Reactions do not repeat consecutively and are suppressed during focus. After a minute without input, idle Todo becomes sleepy and wakes on activity.

Day, Night, Rain, Snow and Sunset dissolve through the existing registered window panes. Rain and snow stay on the glass/outside; birds, fireflies, shooting stars and a five-click constellation are quiet discoveries. Scene audio remains independent of weather. Match my time uses the device clock. An optional “Weather nearby” action asks for browser location permission, rounds coordinates to one decimal place, and requests current conditions from Open-Meteo. Location is not stored, and repeat requests in the same view use a 15-minute in-memory result. Manual scene changes cancel pending lookups. Denied permission and network failures leave the room unchanged.

Panels share readable cream glass, a short spring entrance and quicker close. Tasks reveal like writing, drag to reorder locally, and retain the existing three-task selection limit. Notes accept validated text/Markdown drops, flashcards turn in 3D, and real PDF exports produce a brief paper receipt. Friends remains the clearly labelled existing preview: empty chairs do not pretend to be live participants.

Focus keeps decorative reactions quiet, smooths the table timer's ring between updates, and exposes a small pill with pause, +5 minutes and Done. The pill dims after three seconds of inactivity; keyboard focus restores full opacity. A halfway message and small shoulder stretch are gentle. Completion retains its two choices, adds real sit statistics, and offers chime, voice or silent endings. Existing keepsake milestones animate onto the shelf and unlock a cosmetic hat star or glasses. The break-over voice/wipe still returns to the normal focus room.

Sound layers are optional, start only after interaction, and use original Web Audio textures (soft rain, warm crackle, café-like hush, shoreline and a warm pad), plus quiet prop foley. They are textures rather than field recordings. Existing user-selected YouTube recordings retain their visible official players. Master volume, mute, mixer settings, end cue, time matching and cosmetic choice persist locally. Quiet mode enables the existing reduced-motion preference and mutes room sounds; settings can restore them.

Tune `components/todo/room/cinema-config.ts`; the motion/canvas controller is `cinematic.tsx`, styling is `cinematic.css`, and audio is `sound.ts`. No new 3D dependency, database migration, auth change or AI call is involved. All frame work shares GSAP's ticker. Resize observers cache geometry, DPR is capped, particle pools are bounded, hidden tabs pause effects and audio, and low-core/low-memory/slow-frame devices simplify particles, grain, blur and foreground detail. Reduced motion keeps simple fades and native input. The frame-budget test uses installed Google Chrome with its hardware compositor and writes `outputs/todo-cinema-frame-budget.json`; functional checks also exercise software-rendered Chromium. Forced software rendering is substantially slower, despite the simplified effects. These are local QA measurements, not proof of 60fps on every laptop.

Relevant checks: `npx playwright test --config work/qa.config.ts tests/cinema.spec.ts tests/cinema-performance.spec.ts tests/break-return.spec.ts`. Additional regression coverage lives in `tests/room.spec.ts`.

The weather boundary is covered with mocked geolocation and provider responses; no real visitor location is used during testing. Performance checks require installed Google Chrome. A forced SwiftShader diagnostic remains useful for fallback behavior, but cannot represent hardware-composited laptop performance.

## Shared tables

Firebase rooms, voice, teammate seating, break games, configuration, privacy limits and the complete manual test plan are documented in [docs/shared-tables.md](docs/shared-tables.md). Solo focus remains independent of shared tables.
