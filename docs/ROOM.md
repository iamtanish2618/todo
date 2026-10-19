# Todo's quiet room

The desktop room is a complete 1536 × 1024 image, fitted into a 3:2 stage. It is never cropped or zoomed. Only a decorative copy behind the stage uses cover sizing, static 40px blur and 55% brightness. The phone version is on hold at the user's request; basic CSS fallback is present, but dedicated phone design, interaction and device-performance testing are deferred.

## Run and tune

Run `npm install`, then `npm run dev -- --port 3000`. For existing local checkouts, apply the new schema migration once with:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_square_master_chief.sql
```

See the main README for the two earlier migrations and Firebase setup. Local QA can explicitly use the legacy development account provider; production remains Firebase and requires real verified Todo accounts. The hosted deployment applies the new migration before uploading the Worker.

`components/todo/room/config.ts` is the tuning entry point: artwork path, 3:2 ratio, all room-map rectangles, penguin anchor, contact shadow, invitation, panel and chat placement, chair-front polygon, eye coordinates, colours, motion and default daily allowance. Coordinates are **percentages of the stage**, not browser pixels.

Open `/?debug=1`, then enter Focus with Todo. The room map outlines the window, chair, safe wall, painting, lamp, shelf, rug, penguin and panel area. Debug labels do not intercept clicks. A compact tool rail stays on the left; all expanded tools use the right safe area because a full panel on the left would cover the window. The rail stays clickable while any panel is open. Only one panel opens at once. Escape or its close button returns to the scene.

## Artwork and poses

Room source: `public/art/study-room.png` at its full 1536 × 1024 resolution. This is the existing room matching the supplied map; the brief's generic `room.jpg` was not an additional supplied file. To swap it, keep 3:2 framing, change `ROOM_CONFIG.image`, then use the map to recalibrate the chair, shadow, penguin and panels.

The original code-built wooden desk (`desk-surface` and `desk-grain`) is preserved in front of the chair. Its rounded edge, warm gradients and grain remain. The notebook, pen, coffee and live clock sit on it. Todo is enlarged at the chair behind it, with the lower sprite masked behind the desk. The writing flipper and pencil use a small transform-only writing cycle; the pose itself crossfades to writing only while the focus timer is running. The coffee pose replaces it on breaks. `chairFront` remains in config as reference for the former chair-only composition; it is not rendered in the desk layout.

New transparent pose files, generated with the built-in image tool (not CLI):

| Pose     | Blue companion                      | Pink companion                           |
| -------- | ----------------------------------- | ---------------------------------------- |
| Idle     | `public/art/room-todo-idle.png`     | `public/art/room-todo-idle-pink.png`     |
| Writing  | `public/art/room-todo-writing.png`  | `public/art/room-todo-writing-pink.png`  |
| Typing   | `public/art/room-todo-typing.png`   | `public/art/room-todo-typing-pink.png`   |
| Tea      | `public/art/room-todo-tea.png`      | `public/art/room-todo-tea-pink.png`      |
| Sleeping | `public/art/room-todo-sleeping.png` | `public/art/room-todo-sleeping-pink.png` |

Set the five blue paths in `ROOM_CONFIG.poses`; pink variants use the same filename plus `-pink`. Keep a square transparent canvas and consistent body baseline/camera position. Adjust `penguin` once for both sets. Pose changes crossfade over 250ms. A missing pose falls back to idle. Both eyes blink together; clicks use only brief awe/pop/giggle reactions, with a cooldown, never winks or fingers. Typing and sleeping pause eye tracking.

### Generation prompt set

Blue poses used `todo-seated.png` as the exact character reference and `study-room.png` only as a lighting/camera reference. The shared prompt requested identity preservation; blue knitted pom-pom cap and small matching scarf; the same fluffy charcoal/cream baby penguin, rounded flippers, orange beak/feet and glossy brown eyes; straight-on camera slightly above eye level; amber key light from the right and cool window fill from the left; full seated body with visible feet, centered on genuine transparent alpha; no room, chair, floor shadow, text, extra characters, fingers or winks. Pose-specific actions were:

- Idle: relaxed flippers in lap, both eyes open, contented smile, no objects.
- Writing: cream notebook in lap and short pencil held by a rounded flipper; gaze down at the notebook.
- Typing: charcoal laptop in lap, both flippers on keyboard, eyes toward the screen, no table.
- Tea: cream ceramic cup held close to the belly by both flippers, peaceful smile.
- Sleeping: both eyes fully closed in soft matching arcs, flippers in lap, slight head tilt, no floating symbols.

Each pink edit referenced its exact blue pose and requested: change **only** cap/pom-pom and scarf to dusty rose, make blush slightly rosier, and preserve the framing, body/eye position, camera, lighting, baseline, props and transparent alpha. No zoom, reframing, eyelashes, hair, text, fingers or new objects.

## Tools and persistence

- First visit: only the room, Companion/Agent toggle, back/settings controls, collapsed Ambience, Timer, Tasks, Notes and Invite friends tabs, and the Today invitation. The tool group counts as one UI group. Keepsakes appear only after saved sits.
- Write tasks in the task panel, then explicitly select one to three. New tasks are not silently selected. Start with the physical desk clock or the selected-task button. Completing a chosen task ends the current sit and offers “Todo, take a break”; the remaining choices stay for the next focus.
- Ambience controls day/night window light and optional rain outside. Optional audio uses original synthesized pentatonic keys or filtered rain noise via Web Audio, starts only on explicit selection, has a volume control, and closes its audio context on leaving the room. No external music is downloaded.
- Notes accept local `.txt`/`.md` uploads up to 150 KB / 50,000 characters. Uploaded text is shown for study/editing; Save note persists it privately. PDF import/OCR is not claimed.
- Timer uses a real deadline, survives refresh per verified account, pauses/resumes, updates the browser title, saves completed focus time, and offers a five-minute tea break. Breaks are not added to focus history.
- Tasks, completion timestamps, notes, manual flashcards and focus history live in D1 and are always scoped to the server-verified owner. Up to three focused task IDs are a device-local per-account preference. Historical completed tasks without a completion timestamp are not guessed into this month's total.
- This month aggregates all matching saved sits and new completion timestamps server-side, not only the visible history page. Collectibles derive from saved sits and appear as shelf objects.
- Notes export uses browser-only jsPDF with the locally hosted Noto Sans font; the user's text is not sent to AI to create a PDF.
- Friends is an explicitly labelled table/code-entry preview. It does not join a room, connect microphones, or simulate networking. Games remain on hold.

## Agent mode

The UI calls authenticated `/api/chat`; `/api/assistant` remains an alias for earlier clients. Both use the same server validation, token verification, private provider settings, atomic daily usage reservation and timeout. API keys never enter client code. Available study modes are chat, notes, summary, explanation/photo analysis, quiz questions and flashcards. Text/image uploads remain supported. Output can be saved as notes or exported. The assistant has no coding/execution tool.

A real pending fetch switches Todo to typing and shows the working pill. Closing chat or switching back aborts the request. No fake pending animation is shown without a request. A local daily limit or upstream HTTP 429 closes Agent, selects Companion, disables Agent until the server day resets, and shows the gentle resting message. Server days and monthly aggregates use UTC; the client refreshes allowance at each UTC midnight and on window focus. Default daily allowance is 25 in the config, overridden by the private `TODO_AI_DAILY_LIMIT` setting (clamped to 1–100). Failed requests can consume a reserved use.

No live AI provider key is configured in this project yet. Browser AI tests use clearly identified mock responses; they establish request/pending/fallback behaviour, not live model quality. Companion tools work without AI.

## Verification

Desktop targets: 1440 × 900, 1920 × 1080 and 1024 × 768. `tests/room.spec.ts` checks full image fit, UI count, panel/window/penguin separation, saved tasks and selection limit, deadline/timer persistence, focus versus break history, real multipage PDF output, server-persisted manual flashcards, actual pending browser requests, quota fallback, unavailable AI state, honest friend preview and anonymous/ownership validation. Run with a local server configured for the explicit legacy test identity. Production checks must independently confirm Firebase identity and anonymous API rejection.
