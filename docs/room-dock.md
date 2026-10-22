# Room dock update

The working React 19 / TypeScript app uses Vinext/Vite, shadcn/Radix, GSAP and Cloudflare D1. This update keeps the original room images and existing APIs.

- `components/todo/study-room.tsx` still owns panel state, selection of up to three tasks, notes, flashcards, PDF export, scene selection and Agent callbacks.
- `components/todo/todo-app.tsx` still owns timer deadlines, pause/resume, completion and durable session updates.
- `components/todo/room/scene.tsx`, `penguin.tsx`, `notebook.tsx`, `flippers.tsx`, `mug.tsx` retain the room and character choreography.
- `window.tsx`, `cinematic.tsx` and `cinematic.css` draw registered window scenes. Snow now uses the evening garden under a cold overcast grade, with frost and snow particles; no day-image sun.
- `chat.tsx` retains real server chat, attachment, speech, error and quota handling. The dock uses its actual pending callbacks and daily-rest state.
- Friends remains the existing explicit preview. Shared room codes, invitations, live seats and microphones are not implemented yet; this update does not invent them.

## Feature flag and tuning

The new dock is enabled by `DOCK_CONFIG.enabled` in `room/dock.tsx`. Visit `/?dock=0` for the previous rail, invitation card and mode switch. Both paths use the same data and timer. `?dock=1` selects the new default. No migration or reset is needed.

`DOCK_CONFIG` holds hover maximum, bell radius, lerp, bounce heights and neighbor delays. Dimensions live in `dock.css` as stage-relative container units. The existing stage is an uncropped 3:2 box. Panel safe areas and shared glass live in `dock-panels.css`. Settings → Glass persists its tint in the existing `todo.room.polish.v1` preferences.

## Three stages

1. `room/dock.tsx`, `room/dock.css`: five controls, cached hover geometry, shared GSAP ticker that sleeps when settled, interrupted two-hop bounce and delayed neighbor ripple. Move across all icons and click quickly to check spacing and settling.
2. `room/dock-panels.ts`, `room/dock-panels.css`, `study-room.tsx`, `room/polish-controls.tsx`: shared Radix dialog presentation, anchor-based entrance, one-panel switching, focus setup, readable glass and tint. Test Notes/PDF/Flashcards, all ambience choices, real task selection and timer start, then switch panels and close by X/Escape/outside.
3. `tests/dock.spec.ts`, `tests/break-return.spec.ts`, `playwright.dock.config.ts`: keyboard, touch sheet, reduced motion, resizing, legacy flag, chat quota, focus deadlines, notes and break return coverage. Cursor contrast and overcast Snow are shared `cinematic.css` refinements. The new-panel path keeps room parallax steady while glass is open, and drops the dock backdrop blur during the wave. Small labels use the stronger ink to remain readable on glass.

## Verification

Use Node 22+ and the existing installed dependencies. `npm run dev` serves port 5173. `npm run typecheck` checks TypeScript. `npm run build` builds the actual app.

The browser suite uses the installed Google Chrome hardware renderer:

```sh
npx playwright test --config playwright.dock.config.ts
```

For another local port set `TODO_TEST_URL`. The isolated tests use the existing legacy local test sign-in. Temporarily choose `TODO_AUTH_PROVIDER=chatgpt` in the local-only `.env.local`, restart the dev server, and restore Firebase afterward. Never change the production authentication configuration or use these test fixtures in production. No provider API key is sent by the mocked quota test.

Verification completed: 14 full browser cases passed, followed by targeted checks for expanded-pill spacing, stale panel interrupts, real focus deadlines and motion performance. The final moving-pointer sample averaged 16.67 ms, with 16.7 ms at the 95th percentile, on the tested laptop.

The suite records a frame sample in `outputs/todo-dock-frame-budget.json` and an ambience screenshot. This is evidence for the tested machine, not a guarantee of 60fps on every device. Low-quality and reduced-transparency fallbacks use solid cream surfaces.

## Quiet-mode repair and supplied audio

The retired Quiet button coupled muting with disabling animation. Its persisted combination is migrated once by settings version 2; deliberate gentler motion and OS reduced-motion preferences remain supported. The penguin ticker now resets both eyelids on cleanup and before entering its static mode, so stopping during a blink cannot strand the eyes shut.

Ambience no longer offers nearby weather, location access, procedural texture sliders, or Room sounds & comfort. Its three sound choices use the supplied recordings directly; there is no YouTube player or external playback request.

- Brown: first supplied WhatsApp video, initial/end padding and fades removed, 2-second circular equal-power blend, 12.19-second loop.
- White: second supplied WhatsApp video, edge padding removed, 1.5-second blend, 8.50-second loop.
- Rain: steady 20–80 second section of the supplied 30-minute MP3, 4-second blend, 56-second loop.

The three assets are stereo 44.1 kHz PCM WAV. Using lossless files avoids compressed encoder padding. `room/sound-player.tsx` decodes and caches the buffers on demand, loops on the audio thread with `AudioBufferSourceNode.loop`, and fades selection/stop transitions. A full 30-minute decoded rain buffer would waste memory, so only the seamless excerpt is loaded. The source recordings were not replaced by generated noise. Sample checks found no silent 10 ms blocks or clipping; OfflineAudioContext tests confirmed exact samples on both sides of each wrap. Reports are in `outputs/todo-audio-loop-checks.json` and `outputs/todo-audio-browser-checks.json`.

Dock hover now peaks at 1.25x (center 1.06x), with 7px hops and a much smaller second follow. Panels open from 0.96 scale over 360ms with a smooth ease-out and no overshoot. The warm shooting-star cursor remains available on the light rendering path; OS reduced motion still uses the native cursor.

Follow-up verification: mid-blink stop, legacy Quiet recovery, OS reduced motion, independent local recording selection, decoded wrap boundaries, load errors, no weather/location request, softer panel scale, and shooting-star visibility all passed targeted browser tests. With rain playing and the pointer moving across the dock, the final Chrome sample averaged 16.67 ms per frame (95th percentile 16.8 ms). TypeScript and the production build are also checked before publication.

## Stage 1 visible polish — 23 October 2026

Only Stage 1 of the polish brief is included. Existing tasks/storage, timers,
voice/signalling, AI, break/game rules and artwork remain in place. The visual
switch and two tuning values live in `ROOM_CONFIG.visiblePolish` (`enabled`,
`minimumText`, `doodleFogOpacity`). The saved Glass preference still varies tint
and blur; its lightest setting now has enough cream behind dark text.

Changed application files (the native Vercel port uses identical copies):

- `components/todo/study-room.tsx`: dismiss setup before focus, settings/icon
  labels, remove duplicate Friends entry, plural labels, viewport layout state.
- `components/todo/room/config.ts`: the bounded Stage 1 visual config.
- `components/todo/room/dock-panels.ts`: skip child animation when the Agent
  panel has no generic panel-body children, avoiding an empty-target GSAP warning.
- `components/todo/room/visible-polish.css`: panel rails, viewport sheets,
  internal scrolling, minimum text size, stronger ink/glass, larger break actions,
  softened backdrop, portrait clock fit and removal of the completed arrival clip.
- `components/todo/room/celebration.tsx`: singular counts and sub-minute wording.
- `components/todo/room/shared/table-chat.tsx`: shared tint and sheet-open state;
  chat yields space to another open tool. No message or transport changes.
- `components/todo/room/shared/break-games.tsx`: composite fog at 35%, preventing
  repeated fog regeneration from turning the screen white. Game logic unchanged.

Manual checks for each Stage 1 item:

| Item | Short manual check |
| --- | --- |
| 1. Clipping | At 1366×768, 1280×720, 1440×900, 1920×1080, 768×1024 and 390×844, open Ambience, Notes, Friends, Settings, focus setup and Take a break. Scroll each long body to its last control; the dock stays separate. |
| 2. Glass text | Read Notes tabs, Friends, Settings, chat and tooltips. Text is at least 13px. Move Glass from Clear to Tinted; the cream strengthens without disappearing text. Main ink is #2A2622, muted #4F443B. |
| 3. Grammar | Complete a sub-minute sit: “less than a minute focused”. A one-minute sit / one finished task uses “minute” / “task”; larger counts use plurals. This month and sit invitations use singular labels too. |
| 4. Icons | Hover or keyboard-focus the shelf keepsakes and scene discoveries to read their hints; inspect their existing aria-labels. The top-right cog is “Settings”. |
| 5. Duplicate entry | Open Settings: Friends appears only in the dock, opening the existing Friends panel. |
| 6. Overlap | With one through four companions, open Friends and chat: neither covers a companion, the wall clock or Settings. Only one tool and chat are open at a time. |
| 7. Focus transition | Open Start focusing and click Focus: there are zero setup panels in the focus DOM; no faded card remains over the table. Pause/resume still uses the clock. |
| 8. Doodle | Enter a break, Play → Doodle Art, draw/clear and let fog regenerate: the room remains visible. Press Esc to return. |
| 9. Side areas | Resize to a wide landscape viewport: the blurred continuation is lighter and blends into the scene edges. |
| 10. Break pills | During a break, Play and Sit with Todo have 44px minimum height and cream text on a dark brown surface. |

Verification used disposable local React fixtures with the actual room/panel,
four-seat, chat and game components; no production account, room or microphone
was used for layout tests. The fixture routes are removed before packaging.
All six viewport layouts were measured, along with four-seat Friends/chat
clearance, font minima, absence of the focus ghost, short-session wording and
Doodle/Esc behavior. Browser warnings/errors were empty for these checks.

The production builds and type-checks pass. Full-project lint was run against
both untouched v38 and Stage 1: both report **47 errors and 34 warnings**, with
no additional errors or warnings from this pass. These pre-existing React
compiler/ref/effect, legacy link, test typing and image warnings are retained
rather than disabling rules or refactoring unrelated behavior in a visual-only
stage. Full lint is therefore **not clean**. This records the Stage 1 baseline; the next section covers Stage 2.


## Stage 2 supportive additions — 23 October 2026

Stage 2 only. Stage 3 reliability work and Stage 4 presentation changes are not
included. `ROOM_CONFIG.supportive` references `SUPPORT` in `lib/todo/support.ts`;
its `enabled` flag and timing constants bound the new behavior. No dependency,
secret, database schema, auth, voice transport, game rule or artwork changes.
The native Vercel frontend uses the same UI files and its existing authenticated
proxy to this Sites backend.

Changed files and purpose:

- `lib/todo/support.ts`: shared config, fallback suggestions, saved sound-choice
  migration, actual elapsed time, away-return and reminder timing helpers.
- `components/todo/room/support.tsx` and `support.css`: cancellable tiny-step
  request, three offline suggestions, five-minute action, optional silent nudge,
  quiet fades and bounded assistant answer scrolling.
- `components/todo/room/config.ts` and `polish-controls.tsx`: existing flag and
  saved preference path; new quiet/nudge choices and soft-chime default.
- `components/todo/study-room.tsx`: compose those pieces with existing task,
  timer, Settings, room sound and reduced-motion flows. An unfinished sit is
  preserved: Start 5 minutes is disabled until that sit finishes.
- `components/todo/todo-app.tsx`: honor OS reduced motion, remember a per-user
  last-seen timestamp locally, pass the live deadline and save actual time.
- `components/todo/room/celebration.tsx`: kind early-exit wording and chime default.
- `components/todo/room/cinematic.tsx`: skip decorative events and reset resting
  eye state when motion rests, preserving visible pupils.
- `components/todo/room/chat.tsx`: keyboard-focusable scrolling answer bubbles.
- `lib/todo/ai.ts` and `app/api/assistant/route.ts`: short-answer guidance and the
  tiny-step request mode, using the existing authentication, quota and provider.
- `tests/supportive.spec.ts`, `tests/ai-adapter.spec.ts`: deterministic helper
  coverage and mocked provider contract checks. No real API quota is consumed.
- `docs/room-dock.md`: this scope, changed-file list and manual checks.

Manual check for every Stage 2 item:

| Item | Short check |
| --- | --- |
| 1. Quiet mode | Settings → Quiet mode. Move across the dock and room: no waves, particles, stars or parallax; panels retain gentle fades. Room recordings/SFX/cues stop. Uncheck it to restore saved choices. Friends' live voice remains independent. Turn on OS Reduce Motion and reload: decorative motion stays reduced. |
| 2. Five minutes | Start focusing → Just 5 minutes → Focus. The wall clock starts at 05:00; pause/resume and +5 retain their existing behavior. |
| 3. Tiny first step | Select a task, then I'm stuck. Check the reply, Another idea and Start 5 minutes. With AI unavailable or a daily-limit response, three gentle suggestions appear with no further provider request. Starting a new sit never overwrites an unfinished one. |
| 4. Completion sound | Settings defaults to Soft chime. Choose Todo's voice or Silent, reopen Settings/reload, and finish a sit. Quiet mode suppresses every room cue regardless of this choice. |
| 5. Early exit | End a sit after about 95 seconds, including a pause. The dialog says “That's okay, we showed up.” and “1 minute focused”. A sub-minute sit says “less than a minute focused”. Paused time is not added. |
| 6. Away return | Return on the same browser/account after two days: “Good to see you.” No streak or missed-day message. First visits retain the existing greeting. |
| 7. Short answers | Ask the Agent a normal question: short plain-language guidance is requested. Broad topics offer “Want more detail?”. Ask for detail: a long answer scrolls inside its own bubble, with Save note/PDF still available. Model wording is a provider behavior, not a fixed local response. |
| 8. Nudge | It is off by default. Enable Water & stretch, focus continuously for 50 minutes, and a silent dismissible reminder appears without pausing the clock. Pausing/breaks reset the continuous run. |

Verification: 16 pure tests pass, including the seven supportive/AI cases plus
existing game, TURN and voice-recovery tests. Local browser checks used the
actual TodoApp with disposable tasks, mocked API responses and no microphone or
production writes. Verified AI success, unavailable and 429 paths, Another idea,
five-minute start, actual 9-second session save, gentle early dialog, saved voice
choice, quiet canvas/eye state, away greeting, long-answer scrolling and existing
export controls. The reminder lifecycle was exercised with a local-only shortened
clock; a pure test verifies the production constant remains 50 minutes. Helper
panel fit was checked at all six Stage 1 sizes; no settled horizontal overflow.
Browser warning/error logs were empty. The disposable route is removed before
production builds; no mock account, provider response or shortened timer ships.

An extra legacy session API test was attempted against its hard-coded localhost:
3000 and could not connect in this environment; it was not an application assertion
failure and is not claimed as passed. This stage leaves auth routes unchanged.
Type-check/build results and full-project lint are rechecked before release.
The lint baseline remains 47 errors and 34 warnings, with no added findings;
unrelated existing lint debt is not suppressed or refactored in this stage.
