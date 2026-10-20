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
