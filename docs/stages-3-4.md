# Stages 3 and 4 — reliability and presentation

## Stage 3

The existing React room, shadcn/Radix panels, deadline timer, Firebase presence,
WebRTC voice and in-memory chat remain the architecture. No service, framework,
key or database schema was added. `ROOM_CONFIG.reliability` references the small
`RELIABILITY` config. Existing missing/full room, microphone permission/device
loss, reconnecting state, AI rest, plain-text chat and rate limits are reused.

Changes: `lib/todo/reliability.ts`, `client.ts`, `table/{games,protocol,session,voice}.ts`;
`components/todo/{todo-app,study-room}.tsx`;
`room/{reliability,audio-access}.tsx`, `reliability.css`, `config.ts`, `chat.tsx`,
`sound-player.tsx`, `sound.ts`, `voice-cues.ts`, `celebration.tsx`;
`room/shared/{table-chat,voice-controls,use-table,break-games}.tsx`;
`tests/reliability.spec.ts`.

| Check | Manual test |
| --- | --- |
| Room errors | Join an invalid/expired code, then a full four-person room. Read the calm message; solo focus still works. |
| Connection | Temporarily disconnect/reconnect networking: a quiet offline/reconnecting pill appears, Firebase retries, and failed presence writes retry with a capped backoff. No timer reset. |
| Microphone | Deny permission, try with no microphone, or unplug an external mic. A plain-language notice appears beside the mic/Friends controls; listening/chat remain available. |
| Playback blocked | Select room sound in a browser that blocks audio. Tap “Tap to enable sound”; playback resumes directly from that gesture. |
| Peer trouble | With a peer unreachable, read “Having trouble connecting to [name]…” and retry voice. Existing relay logic is retained. |
| AI allowance | Return 429 from chat: Companion mode resumes with the existing resting message, without exposing a provider error. |
| Refresh | Start or pause focus; close/reload asks for confirmation. Cancel leaves the table connected. Confirm/reopen restores a validated deadline and opens the room with panels closed. Browser-controlled confirmation wording cannot be customized. |
| Offline expiry | Let focus expire offline: work remains at the clock; reconnect retries saving the completed sit. |
| Game invitation | Click Join while focusing: “Available when you take a break.” Stop/restart the inviter's game and try the old invite: “That game has ended.” |
| Late game join | Draw or pop with a friend, then join the current game: a nonce-bound bounded recent-state snapshot replays. Expired/foreign/malformed snapshots are ignored. Doodle's last 20 seconds age with its existing mist; Bubble Pop retains current pop timestamps. |
| Chat privacy/safety | Send ordinary text and an HTML-looking string: it is text, never HTML. More than six messages in ten seconds are throttled. During focus previews stay quiet; leave/close clears local history. The panel states messages disappear when the table closes. Transient encrypted-in-transit signalling delivery is not account-wide chat history. |

Stage 3: both production builds and TypeScript passed; 25 targeted pure tests
passed, covering helpers, timer validation, old game joins, late state, existing
chat/session, games, relay and voice recovery. Full lint retains the established
47 errors / 34 warnings with no new rule findings. These are pre-existing debt,
not disabled rules. Local browser checks and Stage 4 outcomes follow below.


## Stage 4

Existing first-use help, Radix dialogs and dock keyboard behavior were reused.
The hint now waits for actual room arrival rather than being consumed while the
landing page is visible. `PRESENTATION.enabled` gates the new Help entrances and
room-return convenience; static metadata lives in that same config.

Additional files: `app/layout.tsx`, `app/not-found.tsx`,
`lib/todo/presentation.ts`, `components/todo/about-help.tsx`, `presentation.css`,
`room/dock.tsx`, `room/dock-panels.ts`, `room/support.tsx` and existing artwork
references in `face.tsx`, `room/{config,flippers,penguin,shared/seating}.tsx`,
`room/cinematic.css`. New favicon SVG/PNG, Apple icon and 1200×630 share image
use Todo's own graphics/room artwork. WebP derivatives replace PNG downloads
without changing artwork registration; originals remain as source assets.

| Check | Manual test |
| --- | --- |
| Branding/share | View the favicon and page source: the title is “Todo: a little company, a little progress”, warm theme color, OG and Twitter summary-large-image tags point to the 1200×630 PNG. |
| 404 | Open an unknown path: “A little detour.” with Todo branding. Back to the room opens the room for a signed-in user, or the regular account/landing flow for a visitor. |
| First hint | On a browser without the existing welcome key, enter the room: a pointer tooltip says Start focusing. It appears once and is remembered. |
| Help | Open About Todo on the landing page, or Settings → About & help in the room. Read the introduction, three steps, not-a-medical-tool note, privacy and expandable credits. Font license files are linked. Owner-supplied recording rights remain explicitly unverified; no license was invented. |
| Keyboard | Tab through the dock; Enter/Space opens its panel. Tab/Shift+Tab stay inside, Escape closes, and focus returns to the opener. Arrow/Home/End dock shortcuts remain. Warm gold focus rings apply to all new controls, shared chat, tool panels and games. |
| Loading | Load a fresh page: Nunito is preloaded; existing decoded-image entry remains, and room/pose sources use compressed WebP. No dependency/framework or layout rebuild. |

## Follow-up focus/celebration alignment

The user's screenshots were incorporated into this pass. `study-room.tsx` and
`room/support.css` now give custom time a separate row with space above it, and
keep “I'm stuck” plus a centered primary Focus action in a fixed panel footer.
The primary action gently scales on hover. A valid click shows eight soft
sparkles for 300 ms, then unmounts the setup before starting the existing timer.
Closing/switching panels cancels a pending launch; reduced/Quiet motion skips
sparkles and the delay. `room/celebration.tsx` / `celebration.css` use two equal
stat columns with aligned 48px value rows and label baselines. Sub-minute and
zero-task wording now align, and the subtitle has its own centered spacing.

Final browser checks use disposable local data and actual components: safe AI
service-error text with draft retained, offline/online notice, real suspended
AudioContext unlock, compressed images decoding, keyboard open/trap/Escape/
focus return, About sheets, metadata/404, custom-time placement and six viewport
fits. The focus sparkle was observed with eight elements while the panel was
present; once the countdown ran there were zero setup panels. Completion value
rows and labels measured identical vertical bounds in both cells. Mock provider,
network and microphone boundary tests do not consume owner quota or record any
real microphone. No real friend call or physical device unplug was performed in
this pass; the existing voice transport is preserved and its recovery contracts
are tested. Temporary fixture routes and controls are removed before packaging.


Release verification: 28 pure tests pass. The final Focus footer was measured
inside the panel at all six requested sizes (1366×768, 1280×720, 1440×900,
1920×1080, 768×1024, 390×844). Restored focus opened with zero stale panels and
continued its actual deadline. Routine browser logs contained no errors/warnings.
Both builds and TypeScript are required again for this exact release state.
Full-project lint is still the known 47 errors and 34 warnings, without new rule
findings. Source and native frontend receive the same changed UI/shared files.
