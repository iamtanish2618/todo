# Todo's quiet room

The desktop room is a complete 1536 × 1024 image, fitted into a 3:2 stage. It is uncropped at rest. Starting focus gently scales the physical world (including the clock) to 1.055 over 2.4 seconds, around the table; pausing reverses the same transition. Only a decorative copy behind the stage uses cover sizing, static 40px blur and 55% brightness. The phone version is on hold at the user's request; basic CSS fallback is present, but dedicated phone design, interaction and device-performance testing are deferred.

## Run and tune

Run `npm install`, then `npm run dev -- --port 3000`. For existing local checkouts, apply the new schema migration once with:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_adorable_guardsmen.sql
```

See the main README for the earlier migrations and Firebase setup. Local QA can explicitly use the legacy development account provider; production remains Firebase and requires real verified Todo accounts. The hosted deployment applies the new migration before uploading the Worker.

`components/todo/room/config.ts` is the tuning entry point: artwork path, 3:2 ratio, all room-map rectangles, penguin anchor, contact shadow, invitation, panel and chat placement, chair-front polygon, eye coordinates, colours, motion and default daily allowance. Coordinates are **percentages of the stage**, not browser pixels.

Open `/?debug=1`, then enter Focus with Todo. The room map outlines the window, chair, safe wall, painting, lamp, shelf, rug, penguin and panel area. Debug labels do not intercept clicks. A compact tool rail stays on the left; all expanded tools use the right safe area because a full panel on the left would cover the window. The rail stays clickable while any panel is open. Only one panel opens at once. Escape or its close button returns to the scene.

## Artwork and poses

Room source: `public/art/study-room-round-v2.png` at its full 1536 × 1024 resolution. This is a newly generated miniature scene using the video screenshot for camera/perspective and our established penguin for material style. The earlier room is retained as `study-room.png`. The brief's generic `room.jpg` was not an additional supplied file. To swap it, keep 3:2 framing, change `ROOM_CONFIG.image`, then use the map to recalibrate the chair, shadow, penguin and panels.

The round wooden table is fully visible with its legs and rug. A registered second copy of the room, clipped by `ROOM_CONFIG.tableFront`, sits in front of Todo. It masks his lower body behind the tabletop and uses the exact source pixels, avoiding guessed furniture edges. The notebook, writing flipper, coffee, jars, lamp and timer are independent code layers placed on its top surface. The old first-person desk styles and original artwork remain available but are not rendered in this composition.

`room/scene.tsx` reveals the notebook gently as the room settles. The lamp starts off. Focus begins a 1.2-second notebook lift and pencil preparation, followed by the writing loop; the lamp automatically warms up without a reaching hand. All ordinary controls fade and become inert during focus, leaving the physical clock reachable. The clock uses smaller, tabular digits with extra line-height for glyph overhang. Lamp toggles use a 1.2–1.3 second shade/light-pool fade, with no reaching hand and no leftover decorative flipper. The book stays in place when the lamp is toggled.

`room/notebook.tsx` draws curved paper, page stacks, cloth cover, binding and a contact shadow in the table's perspective. `room/flippers.tsx` attaches two rounded, textured flippers to fixed shoulder pivots. The left flipper holds the pencil through an 8.4-second cycle of small strokes, pauses and pencil resets; the right steadies the page with slower adjustments. They animate only during an active focus timer. During a break, both flippers and the mug share a 16-second lift/sip/lower sequence. The table mug fades out while Todo holds it, leaving its saucer. Steam is slow and faint. The coffee rig uses the idle torso. Writing uses dedicated blue/pink focused sprites with lowered heads and downward pupils; cursor tracking cannot override their gaze. The flipper rig samples their actual fur through feathered masks and rotates around fixed shoulder pivots, with an 8.4-second phrase/pause/pencil-reset cycle and a slower supporting flipper. See [focused pose assets and exact prompts](FOCUSED-POSE-PROMPTS.md). Reduced motion keeps the correct poses without cycling motions.

The live circular timer is a CSS/SVG object with an extruded case, beveled face, dial ticks, progress ring, feet and a separate contact shadow. Its bottom is at ~62.5% image height, safely on the top of the table, above the ~73% front rim. It is not attached to the table edge. It is the only interactive timer in the room. Choose up to three tasks if desired, then click the clock face to open a compact setup panel. Enter a whole number from 1–120 minutes or use a 15/25/30/45/60/90-minute preset, then press Focus. Clicking the clock always opens this setup directly; it never redirects to Tasks. With no selected task, the timer starts a Quiet focus sit. A second faint countdown is drawn at 15% opacity behind Todo, naturally occluded by his opaque sprite; the circular tabletop clock remains the interactive timer. The old adjustment crown is removed. The clock face pauses/resumes an existing session. Press Escape to pause and restore controls; the finish check is available while paused. The separate Timer tab/panel and the extra break countdown are removed. Starting a break closes its invitation so the clock remains reachable.

New room asset and exact generation prompt: `public/art/study-room-round-v2.png` and `docs/ROOM-ART-PROMPT.txt`. Generated with the built-in image tool, not CLI. No character or interactive props are baked into this background.

New transparent pose files, generated with the built-in image tool (not CLI):

| Pose     | Blue companion                      | Pink companion                           |
| -------- | ----------------------------------- | ---------------------------------------- |
| Idle     | `public/art/room-todo-idle.png`     | `public/art/room-todo-idle-pink.png`     |
| Writing  | `public/art/room-todo-writing.png`  | `public/art/room-todo-writing-pink.png`  |
| Typing   | `public/art/room-todo-typing.png`   | `public/art/room-todo-typing-pink.png`   |
| Tea      | `public/art/room-todo-tea.png`      | `public/art/room-todo-tea-pink.png`      |
| Sleeping | `public/art/room-todo-sleeping.png` | `public/art/room-todo-sleeping-pink.png` |

Set the five blue paths in `ROOM_CONFIG.poses`; pink variants use the same filename plus `-pink`. Keep a square transparent canvas and consistent body baseline/camera position. Adjust `penguin` once for both sets. Non-writing pose changes crossfade over 250ms; the writing rig uses the focused base as described above. A missing pose falls back to idle. Both eyes blink together; clicks use only brief awe/pop/giggle reactions, with a cooldown, never winks or fingers. Typing and sleeping pause eye tracking.

### Generation prompt set

Blue poses used `todo-seated.png` as the exact character reference and `study-room.png` only as a lighting/camera reference. The shared prompt requested identity preservation; blue knitted pom-pom cap and small matching scarf; the same fluffy charcoal/cream baby penguin, rounded flippers, orange beak/feet and glossy brown eyes; straight-on camera slightly above eye level; amber key light from the right and cool window fill from the left; full seated body with visible feet, centered on genuine transparent alpha; no room, chair, floor shadow, text, extra characters, fingers or winks. Pose-specific actions were:

- Idle: relaxed flippers in lap, both eyes open, contented smile, no objects.
- Writing: cream notebook in lap and short pencil held by a rounded flipper; gaze down at the notebook.
- Typing: charcoal laptop in lap, both flippers on keyboard, eyes toward the screen, no table.
- Tea: cream ceramic cup held close to the belly by both flippers, peaceful smile.
- Sleeping: both eyes fully closed in soft matching arcs, flippers in lap, slight head tilt, no floating symbols.

Each pink edit referenced its exact blue pose and requested: change **only** cap/pom-pom and scarf to dusty rose, make blush slightly rosier, and preserve the framing, body/eye position, camera, lighting, baseline, props and transparent alpha. No zoom, reframing, eyelashes, hair, text, fingers or new objects.

## Tools and persistence

- First visit: only the room, Companion/Agent toggle, back/settings controls, collapsed Ambience, Tasks, Notes and Invite friends tabs, and the Today invitation. The tool group counts as one UI group. Keepsakes appear only after saved sits.
- Write tasks in the task panel, then explicitly select one to three. New tasks are not silently selected. Start with the physical desk clock or the selected-task button. Completing a chosen task saves the current sit and opens the celebration; remaining chosen tasks stay selected for the next focus.
- Day/night uses a 2.1-second crossfade inside four exact glass-pane masks. The morning asset has a round sun, blue sky and sunlit trees, with no moon or stars. Soft interior sunlight fades in at the same pace. The original room/window frames and table remain registered. Day art: `public/art/study-room-morning-v1.png`; exact built-in image-tool prompt: `docs/MORNING-ART-PROMPT.txt`.
- Rain uses 22 short, low-opacity drops plus 9 slow glass beads, clipped to the window panes. The former long, fast streaks are removed. Reduced motion leaves quiet static beads.
- Weather never starts or changes audio. Rain shows an overcast early-evening window, with no sun, moon or stars. `public/art/study-room-evening-v1.png` was made with the built-in image tool from the morning artwork; only its window panes are crossfaded into the room, preserving the table and woodwork. Exact edit prompt: `docs/EVENING-ART-PROMPT.txt`.
- The exact user-selected YouTube recordings are configured in `room/ambience.ts`: White noise (`ooyuJ-01TS0`), Brown noise (`InlECJg9FFw`), Rainy noise (`CpS5Ex1Wx-4`). The original synthesized morning/night tones and bundled rainfall playback are removed from the UI/runtime. The previous public-domain recording files and their credits remain as unused source assets.
- `room/sound-player.tsx` loads the official YouTube IFrame API only after an explicit sound choice. A visible, unobscured player of at least 200×200 stays in the room during focus and breaks; videos are not downloaded, extracted, cropped or hidden for audio-only playback. It starts at 25% player volume, offers native playback controls, and loops the selected recording. Weather changes and closing tools leave it mounted. Switching recordings destroys the previous player; Sound off, Stop sound and leaving the room destroy playback. The celebration pauses it while the dialog is visible and resumes only if it had been playing. Autoplay blocks explain that the user should press Play; embedding/network failures offer the exact source link. YouTube availability, ads and browser autoplay rules still apply.


- Notes accept local `.txt`/`.md` uploads up to 150 KB / 50,000 characters. Uploaded text is shown for study/editing; Save note persists it privately. PDF import/OCR is not claimed.
- Timer uses a real deadline, survives refresh per verified account, pauses/resumes, updates the browser title, saves completed focus time, and opens the celebration when focus ends. Breaks are not added to focus history.
- Selecting a task darkens the entire row without completing or crossing it out. A separate, labelled check marks it finished. Active tasks are saved indefinitely until explicitly deleted. The task filter is removed. Finished tasks open in their own panel with recorded focus time and a Reopen action. Finishing the current timed task saves its active sit before marking it complete, so the resulting record includes that time. The task ID is verified against the signed-in owner before a sit is saved; task totals aggregate every linked sit, not just the 50 most recent sessions. Duplicate titles cannot mix. Older records without task IDs say Not timed; they are not assigned guessed times. An in-progress legacy timer is linked only if exactly one active task matches its title.
- Tasks, completion timestamps, notes, manual flashcards and focus history live in D1 and are always scoped to the server-verified owner. Up to three focused task IDs are a device-local per-account preference. Historical completed tasks without a completion timestamp are not guessed into this month's total.
- This month aggregates all matching saved sits and new completion timestamps server-side, not only the visible history page. Collectibles derive from saved sits and appear as shelf objects.
- Notes export uses browser-only jsPDF with the locally hosted Noto Sans font; the user's text is not sent to AI to create a PDF.
- Friends is an explicitly labelled table/code-entry preview. It does not join a room, connect microphones, or simulate networking. Games remain on hold.

## Simplified controls

The bottom invitation contains only What are we doing? and Sit with Todo (or Edit your tasks once selected). `room/polish.css` gives tools a more opaque warm surface, system sans-serif type, darker task text, and a short fade/zoom when changing panels. Room entry uses a small running Todo on a progress line; the percentage is capped by decoded artwork readiness, reaches 100%, then fades into the room. Reduced motion skips the running animation. Ambience has Day/Night/Rain weather cards and independent stacked audio cards: Sound off, White noise, Brown noise, Rainy noise. Rain is a silent evening scene; selecting any weather preserves the existing sound choice. The volume slider and separate rain toggle are removed. Device/system volume controls playback level. The same new stoneware SVG mug is used on the table and while Todo drinks, with curved ceramic glazing, an inset coffee surface, contact shadow, and a saucer.

## Completion and breaks

`room/celebration.tsx` uses the shared shadcn dialog with Todo, a brief happy hop and soft confetti. It has exactly two buttons: **Take a break** and **Continue focusing**. Closing outside or pressing Escape cannot skip this choice. The optional two-note Web Audio chime follows the existing room sound-effects preference; its context is closed after playback and on unmount. Gentler motion removes the hop/confetti movement.

Take a break opens a compact time picker: whole-number custom durations from 1–120 minutes, with 3/5/10/15/20/30-minute shortcuts. **Start break** begins a persisted deadline, hides and disables ordinary room controls, and switches Todo to the sipping-coffee rig. The faint background countdown and tabletop clock both show break time. The only bottom actions are **Focus again** (end the break and return to the landing page) and **End break** (restore the room). The clock or Escape can pause a break without revealing extra panels. At zero the calm room remains until either action is chosen. Refresh restores an active or paused break; breaks never create focus-history records.

Continue focusing stays in the room. It resumes a paused focus sit if another task was completed during it; otherwise it opens focus setup for remaining selected tasks, or Tasks if none remain. No summary/recap panel intervenes. Finishing a sit saves elapsed time; it does not mark unfinished tasks done automatically.

## Agent mode

Agent mode now replaces the lower invitation with one frosted chat surface, fades ordinary controls away and zooms the table gently. Back to room/Escape restore the workspace. Typed messages, text/image attachments and browser dictation feed a reviewable composer; Enter sends and Shift+Enter adds a line. Dictation is browser-dependent and is not real-time audio chat. See [Gemini setup](AI.md). The UI calls authenticated `/api/chat`; `/api/assistant` remains an alias for earlier clients. Both use the same server validation, token verification, private provider settings, atomic daily usage reservation and timeout. API keys never enter client code. Available study modes are chat, notes, summary, explanation/photo analysis, quiz questions and flashcards. Text/image uploads remain supported. Output can be saved as notes or exported. The assistant has no coding/execution tool.

A real pending fetch switches Todo to typing and shows the working pill. Closing chat or switching back aborts the request. No fake pending animation is shown without a request. A local daily limit or upstream HTTP 429 closes Agent, selects Companion, disables Agent until the server day resets, and shows the gentle resting message. Server days and monthly aggregates use UTC; the client refreshes allowance at each UTC midnight and on window focus. Default daily allowance is 25 in the config, overridden by the private `TODO_AI_DAILY_LIMIT` setting (clamped to 1–100). Failed requests can consume a reserved use.

Gemini 3.6 Flash is configured privately for the adult-audience version. Browser regression tests use clearly identified mock responses; a separate real adapter request verified live inference. Companion tools work without AI. End break explicitly restores the workspace; Focus again retains its existing route to the landing page.

## Verification

Desktop targets: 1440 × 900, 1920 × 1080 and 1024 × 768. `tests/room.spec.ts` checks full image fit, UI count, panel/window/penguin separation, saved tasks and selection limit, deadline/timer persistence, focus versus break history, real multipage PDF output, server-persisted manual flashcards, actual pending browser requests, quota fallback, unavailable AI state, honest friend preview and anonymous/ownership validation. Run with a local server configured for the explicit legacy test identity. Production checks must independently confirm Firebase identity and anonymous API rejection.

The room checks verify direct lamp toggles without reaching-hand layers, notebook depth, circular clock geometry/contact height, custom duration setup, darkened task selection without completion, immersive UI hiding, camera zoom, Escape/clock pause and resume, countdown fit at all desktop targets, day/night glass masks, slower rain, both writing flippers moving, coffee lifting, exact YouTube recording IDs, silent evening weather, independent audio/weather selection, player sizing and lifecycle cleanup. Player error/autoplay cases use an explicitly mocked API boundary; real third-party playback is checked separately in the browser. Subjective sound preference is left to the listener. The video was inspected through its visible player; no original app source code was available.
