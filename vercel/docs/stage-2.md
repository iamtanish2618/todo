# Stage 2 release notes

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
