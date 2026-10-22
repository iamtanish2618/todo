# Shared tables, voice and break games

Todo keeps its original Vinext/React room, artwork, shadcn glass dock, deadline-based timer, account system and saved tasks/notes. Shared modules attach to that room; solo mode does not need a connection.

The original brief named Supabase. At the user's request on 21 October 2026, the implementation uses the existing **Firebase project and Firebase Realtime Database instead**. No Supabase account, package or key is required. Google/email Todo accounts are reused; no extra login is introduced.

## Configuration

Realtime Database has been provisioned in `asia-southeast1` for the existing project with billing disabled. The site uses its existing public Firebase app settings plus:

```
TODO_FIREBASE_DATABASE_URL=https://YOUR-DATABASE.asia-southeast1.firebasedatabase.app
TODO_FEATURE_TABLES=1
TODO_FEATURE_VOICE=1
TODO_FEATURE_BREAK_GAMES=1
```

Each feature can be disabled with `0`. Games work solo; disabling tables does not disable solo focus. With no database URL, Friends clearly says shared tables are not connected. Never put a service-account key in client configuration.

For another Firebase project, enable Google/email Authentication and create Realtime Database in **locked mode**. Deploy `database.rules.json` with `firebase deploy --only database --project YOUR_PROJECT`. The rules require a verified Todo account. Public Firebase web settings identify the project; the rules authorize access. Do not replace the rules with public read/write or test mode.

Official references: [Realtime Database setup](https://firebase.google.com/docs/database/web/start), [presence and onDisconnect](https://firebase.google.com/docs/database/web/offline-capabilities), [database rules](https://firebase.google.com/docs/database/security).

## Modules and temporary data

- `lib/todo/table/protocol.ts`: bounded codes, names, schemas, member order and rate limits.
- `transport.ts`: Firebase adapter; `session.ts`: room lifecycle, deterministic host, reactions, clock estimates and shared focus invitations.
- `voice.ts`: audio-only WebRTC mesh with one microphone stream and at most three peer connections. Firebase only carries connection messages, never audio.
- `games.ts`: break-only game lifecycle and validation.
- `components/todo/room/shared`: Friends UI, audio controls, original-character seating and break activities.
- `/api/rooms/config`: public runtime configuration, separate from secrets and existing AI APIs.

The database contains temporary `tables/CODE/members`, recipient-specific `inbox` messages and private `tableClaims` ownership bindings. Nicknames are chosen for a table, not copied from account profiles. Email addresses and profile names are never in presence. Ownership uses private Firebase UIDs that other clients cannot read. Messages are removed after receipt or a short expiry fallback; presence and inboxes have server-side disconnect cleanup. This is temporary transport storage. The table keeps a bounded, in-memory conversation (last 200 entries) after receipt; it is not a permanent chat archive. Leaving the table clears your conversation, and reloading does not restore old messages. Audio and drawings are never recorded or archived. Drawings reset at the end of each break.

Room codes are shared invitations, not passwords. Verified users who know a code can see that table's nicknames and status. Root enumeration is denied. Capacity is enforced by clients, so a modified client can bypass that limit. Client rate limits are not a substitute for a server abuse service at larger scale. Firebase's free plan limits simultaneous connections/traffic; monitor usage before a public launch. The project has no paid billing enabled.

## Voice and network limits

Microphones start muted. Permission is requested only from Unmute. A listener can receive audio without granting mic access. Audio needs HTTPS (localhost is allowed). Each pair chooses the offerer by its random tab ID, negotiates a send/receive audio transceiver before any microphone is enabled, and uses replaceTrack on first enable. Later mute/unmute changes track.enabled. ICE queues until the remote description is ready. A failed connection gets one ICE restart.

Remote audio plays through one native, unmuted, playsinline audio element per peer. Incoming mute and volume apply directly to that element. Web Audio is reserved for local microphone metering; remote speaking indicators use decoded inbound RTP audio levels. The call does not depend on an analyser graph to drive the decoder. AudioContext resume starts in the user gesture and never holds microphone permission hostage if the browser leaves resume pending. A blocked media element exposes Enable sound; the next interaction or return to the tab also retries playback. Offers, answers, and ICE are serialized per peer, and first microphone capture updates SDP for initially listen-only peers. A watchdog exposes Reconnect voice and a specific relay/network explanation when a connection fails. Local speaking detection uses 512-sample RMS at 15Hz on GSAP's existing ticker; remote indicators poll decoded inbound RTP audio levels about five times a second. No microphone stream is created for that indicator alone.

The bottom-left microphone button is the single mic control. Starting focus or a break leaves the user’s manual mic choice unchanged. Friends retains Mute everyone for incoming audio; there is no automatic quiet-table mode. Host requests can only mute, never enable another person's mic. Host migration follows current member order.

Default discovery uses `stun:stun.l.google.com:19302`. Direct calls remain the first
choice; a configured TURN service supplies UDP, TCP and TLS relay fallback.

### No-card relay setup (Open Relay / Metered)

Create the free relay app in Metered, select its no-card plan, and create a
credential for Todo. Use the credential's **API Key**, not the account's secret
key. Keep these in private server configuration:

```
TODO_TURN_METERED_HOST=YOUR_APP.metered.live
TODO_TURN_METERED_API_KEY=YOUR_CREDENTIAL_SCOPED_API_KEY
```

Confirm the allowance shown in the actual provider dashboard; free limits can
change. No paid plan or overage authorization is required by Todo. The server
fetches only this fixed provider's credential endpoint and caches its ICE settings
for five minutes. Credential expiry/revocation is controlled in Metered; refreshing
ICE does not extend an expired credential. Rotate it in the dashboard and replace
the scoped key if revoked/expired. Never commit credentials or paste them in chat.

### Optional Cloudflare alternative

Cloudflare requires activating a usage-billed Realtime subscription even with its
free allowance. It has not been activated for this setup. If deliberately enabled
later, configure `TODO_TURN_KEY_ID` and `TODO_TURN_API_TOKEN` on the server. Todo
requests four-hour ICE credentials, reuses them for one hour per signed-in user,
and never sends the master token to a browser. Metered takes precedence if both
providers are configured. Legacy `TODO_TURN_URL`, `TODO_TURN_USERNAME`, and
`TODO_TURN_CREDENTIAL` remain supported for an existing custom relay.

### Access, renewal and verification

`GET /api/rooms/config` returns STUN-only availability settings to guests. Relay
settings are returned only after Todo independently verifies the Firebase account.
Responses are private/no-store and vary by identity. The Vercel bridge forwards
Todo's Firebase identity, not hosting-platform identity. No account secret/API key
appears in the returned ICE array. Browser connection credentials necessarily
reach the caller and must be treated as usable within their provider's lifetime.

The room sends its fresh identity token, refreshes configuration every 30 minutes
while active and on return to the tab, and updates existing peer connections with
`setConfiguration`. Provider outages leave direct voice and table chat available;
they do not establish that a relay is working. No microphone permission or automatic
unmute is introduced. Audio remains encrypted between browser peers.

Run `npx playwright test tests/turn-relay.spec.ts` for provider boundary/cache tests.
After configuring private `.env.local`, run the owner check:

```
node --env-file-if-exists=.env.local scripts/verify-turn.mjs
```

That check forces both peers to use TURN and verifies incoming audio packets and
decoded audio energy in both directions using generated tones. It prints no keys,
credentials or IP addresses and captures no physical microphone. A successful
local relay check is not a guarantee that every institution's firewall permits
calls; test friends on separate networks as well.

## Behavior

Codes use `PENG-XXXXXX`, cryptographic randomness and a 32-character unambiguous alphabet. Join waits for presence and never creates a missing room. There are four admitted seats. Duplicate nicknames receive a number. The host is the earliest present member; host controls are verified against current presence. Joining a shared focus session is optional and uses the **existing timer** with a shared deadline. Already-started sessions are not overwritten.

The 3:2 room and complete oak table are preserved. Original penguins slide to percentage-based seats, wear their chosen knit color, and show an arrival nickname before settling into table name tags. The scene uses original assets only; the user's screenshot contributes layout guidance, not artwork.

Friends uses a wider sidebar with one Leave table action. Successful code/link copies animate a small confirmation inside the code capsule, without changing its size. The room’s image cutouts stay registered rather than moving independently with the cursor; the shooting-star cursor, eyes and character animations remain.

Play appears only during a break. Doodle Art opens in a full-viewport portal, beyond the room’s aspect-ratio letterboxing. Clear resets the shared mist, and Done/Escape closes the drawing surface with focus restoration. It also closes automatically when the local break ends; normalized stroke batches are capped at 50 points, 20Hz per sender and 200 recent stroke IDs. Fog regrows gradually. Bubble Pop replaces Breathing Bubble: 24 floating bubbles pop with a small sparkle, then regrow. Hover/focus holds a target still. Tablemates can join the same activity and share validated pops; there are no scores or recordings. Late break participants can request the current activity and join optionally. Focused members never receive game invitations. Ending/skipping a break closes local game UI immediately and leaves other members' breaks alone. Games and speaking analysis share GSAP's ticker; no extra RAF loop is introduced.

## Verification

Commands:

```
npm run typecheck
npm run lint
npm run build
npx eslint lib/todo/table components/todo/room/shared app/api/rooms
```

The original repository has 39 pre-existing lint errors (React compiler rules concerning existing refs/effects). These are recorded in `outputs/rooms-baseline-lint.txt`; they are not disabled or hidden. New module lint must have zero errors. Existing app logic has not been broadly rewritten to silence unrelated diagnostics.

Isolated integration tests use Firebase Authentication and Database emulators with the real rules, multiple Chrome contexts, and fake microphone audio. They create no production user accounts. `tests/fixtures/table-harness.tsx` is a development QA fixture, not imported by the production app. Start the local dev server and:

```
firebase emulators:start --only auth,database --project demo-todo --config firebase.emulators.json
npm run test:tables
```

For the existing app's local tests, use its ChatGPT test authentication mode locally only; production remains Firebase. The test command generates a deterministic microphone WAV under ignored outputs; it is never shipped as an ambience recording. Test result details are in `outputs/table-stage*-*.txt`.

## Manual acceptance plan

Use headphones and two or three separate browser profiles/windows:

1. Create a table and join B/C by code; inspect original artwork, seats, names, arrival pop/wave and join/leave cues.
2. Open an invite URL; log in if needed; the Friends panel must prefill the code. Try a wrong code, a duplicate nickname and a fifth person.
3. Unmute A; B/C must hear A and show its speaking ring. Keep B microphone permission unrequested and verify B can still listen. Mute A and verify silence.
4. Change per-person volume, mute all incoming, deny permission, unplug a microphone and revoke permission. Check friendly messages and the persistent Mic on indicator.
5. Focus with a live mic, then enter a break: verify that the manual mic choice stays unchanged. Only the bottom-left mic control toggles local capture.
6. Leave as host, then try the next host’s ask-to-mute and remove controls. Friends must have no Close table button. A non-host must not control the room.
7. Host starts Sit together; consenting idle clients should share a deadline within 500ms. Declining or already-focusing clients keep their own work.
8. Disconnect/reconnect one browser. Presence returns, old voice connections are replaced and no orphan microphone remains after Leave.
9. **Real-device check required:** a phone on mobile data and a laptop on Wi-Fi. If audio fails, provision TURN; a local/emulator test cannot establish that a strict network will work.
10. Play is absent in idle/focus/recap and present in break. Share a doodle, clear it, join Bubble Pop late, end one member's break and confirm only their game closes.
11. Test keyboard navigation, visible focus and OS reduced motion. Reduced motion uses fades and suppresses wave/sparkles/bubble drifting transforms.
12. Recheck saved tasks, completed-task history, timer editing, notes/flashcards, three supplied looping audio recordings, Agent chat/attachments and quota behavior.

No automated test is a substitute for listening on two real devices with headphones. Cross-network audio, real permission revocation/unplugging and iOS hardware behavior must be checked on those devices.

## Shared tables baseline (v28)

- 15 shared-table checks passed in Chrome, using the real Firebase emulators/rules and real WebRTC with a synthetic microphone. Includes wrong/missing rooms, capacity, duplicate names, host migration/moderation, listening without capture, denied capture, incoming volume, reconnect recovery, real Todo invite entry, matching timer deadlines, shared doodles, late breathing joins, solo breaks and reduced motion.
- All 21 existing dock/room regression checks passed, including tasks, timer pause/extend, notes/PDF/flashcards, AI request/quota UI, scene changes, the three supplied seamless recordings, open eyes, cursor, keyboard, resizing, break return and desktop frame budget.
- TypeScript passed. New module lint has zero errors and one existing image-policy style warning on the original avatar layer. Full-repository lint still has the original 39 errors; no rule was disabled.
- Database rules passed Firebase's syntax check and were deployed to the existing project. Billing remains disabled.
- Actual cross-network phone audio, physical microphone unplugging/revocation and iOS hardware are outstanding manual checks. Browser tests simulate permission denial; they do not certify every device or network.

Stage file map:

| Stage | Main files |
|---|---|
| Rooms | `lib/todo/table/{protocol,transport,session}.ts`, `shared/{use-table,friends}.tsx`, `/api/rooms/config` |
| Voice | `lib/todo/table/voice.ts`, `shared/{use-voice,voice-controls}.tsx` |
| Teammates | `shared/seating.tsx`, `shared/shared.css`, small plugs in `scene.tsx`, `penguin.tsx`, `study-room.tsx` |
| Games | `lib/todo/table/games.ts`, `shared/break-games.tsx`, `shared/games.css` |
| Hardening | `database.rules.json`, `firebase.emulators.json`, `tests/table-*.spec.ts`, `tests/fixtures/table-harness.tsx`, config/status routes, shared timer bridge in `todo-app.tsx`, this guide |

The final cleanup regression also covers two tabs signed in to the same account. Leave removes protected nodes before releasing their private ownership claim, and only cancels its server disconnect fallback after successful cleanup. Each teammate’s writing/coffee animation follows their own presence status.

## Friends and Doodle refinement

- Removed the duplicate panel mic button, quiet toggle/automatic focus muting and Close table action.
- The right sidebar is 300–370px on desktop, with slightly tighter three/four-person seating so faces remain clear.
- Clipboard success is shown only after the browser confirms the write, fades back to the selectable code, and replays on subsequent copies. Failure offers a manual-copy fallback.
- Doodle covers 100vw × 100dvh, including room letterboxing. The drawing protocol, rate limits, live sharing and break lifecycle are unchanged.
- Tests cover actual clipboard payloads, repeat confirmation, unclipped full-screen shared strokes and cursor/room registration. Fixtures wait for the app document’s hydration and are excluded from production’s entry graph.

Verification for this refinement: all 16 shared-table checks passed across the main run and targeted reruns, plus 3 focused cursor/break-return regression checks. TypeScript and scoped lint passed (the existing avatar image warning remains). The initial combined run experienced timeouts under heavy laptop load; affected checks passed when rerun sequentially. The original 39 full-repository lint errors remain outside this change.

## Focus, daylight and Bubble Pop (v30)

The full dock fades out during focus; the small existing focus controls and physical clock remain usable. The wake-up sequence runs once per room entry. Focus and breaks suppress the idle sleepy-lid effect, and closed lids have a visible crease. Coffee and writing flippers share warmer daylight shading.

Play has a warm, high-contrast button with a restrained invitation pulse. The game picker zooms in gently, game exit fades back to the room, and break entry/game return have a soft light sweep and small camera settle. OS reduced motion uses fades and stationary bubbles.

Bubble Pop reuses the break-only lifecycle and full-viewport portal. Its 24 real buttons support mouse, touch, Tab and Space. A shared pop contains only a bounded slot, game start and timestamp; the receiver verifies current break membership, active game, slot and timestamp. Pops are ephemeral, rate limited to 20 per second, and disappear when the local break ends. The legacy `breathe` presence value remains accepted for tabs opened before this release; it is no longer a menu option. Database ownership/access rules are unchanged.

The bubble portal keeps the actual room artwork, weather and lighting visible beneath a light brown dimming veil, with warm dark controls. Each game seeds randomized positions, sizes, directions and independent speeds (14–59 px/s); headings wander gently and reflect at safe screen edges. Movement uses clamped delta time on the existing GSAP ticker. Resize measurements are cached outside the animation loop. Hover/keyboard targets pause for accurate popping; reduced motion keeps the randomly scattered field stationary. A small personal pop counter increments only for your accepted clicks, and resets on a new game; tablemates' pops do not increase it. Done/Escape uses one 450ms dissolve, without a second room light sweep or camera zoom. Browser checks cover varied displacement, room styling, pop/regrowth, counter reset, resizing and exit.

Verification: 10 focused checks passed across protocol/session validation, Firebase rules, shared Doodle/Bubble Pop, solo/reduced-motion play, focus pause/extend, daylight pupils, hidden dock, and game return. TypeScript and scoped lint passed (the existing avatar image warning remains). Native desktop checks exercised focus → break → Bubble Pop → room without using production task data. Full-repository lint retains its documented pre-existing errors.


## Table conversation and room polish (v35)

A small Chat control opens a shadcn-based glass conversation panel inside a shared room. During focus the composer control is hidden; on a break it remains available, including above a game. Incoming names/messages appear in transparent bottom-right previews for ten seconds, then disappear from the preview only. The scrollable current-table conversation retains chat, arrivals/departures, focus/break activity and game invitations, up to 200 entries. Chat accepts plain text up to 1,000 characters and six messages per ten seconds per sender; HTML is never interpreted. Sender names come from authenticated room presence, not message payloads. No audio is recorded.

Game notices are received even while another game is open. Join is enabled only during a local break when the inviting member is still in that game, with the same game-start timestamp. Ended/older invitations remain readable but cannot start a stale game. Unknown peers, malformed payloads and duplicate IDs are rejected. Messages are session-only, not synchronized history for future arrivals or a permanent archive.

Companion and knit color are separate presence fields. Friends starts with the chosen blue/pink beanie, and the female artwork remains female even when another beanie color is chosen. The optional companion field is validated in Firebase rules; legacy presence falls back to its existing blue/pink color.

The single larger working clock is mounted at 66%/10% on the wall, with a straight face and soft wall shadow. The complete original oak table stays intact. The hanging-plant breeze hit area and framed-picture surprise are removed; the Doodle Art break game remains available.

QA uses isolated Firebase Auth/Realtime Database emulators and synthetic microphone streams, not real account tokens or personal tasks. Chromium's test-only `--disable-audio-output` replaces the unavailable host hardware sink while retaining the audio-rendering path; normal autoplay rules remain enabled. This does not verify physical speakers or cross-network NAT traversal. A TURN relay is still required for networks where direct WebRTC cannot connect.

## Reconnect recovery and Vercel relay delivery

The native Vercel deployment now owns its `/api/rooms/config` route. It preserves
upstream room availability but independently validates Todo's Firebase identity
before attaching its own server-only `TODO_TURN_URL`, `TODO_TURN_USERNAME`, and
`TODO_TURN_CREDENTIAL` settings. This avoids relying on the legacy host's proxied
identity/relay lookup. The configured relay is the owner's approved Metered
credential over TLS/TCP on port 443. Guests receive discovery servers only; both
account and shared-room data access continue to use existing verification.

Reconnect refreshes configuration, applies it to the peer connection, and performs
an ICE restart. Manual retries are accepted even if the offerer already used its
automatic retry. The reconnect control is based on failed/disconnected peer state,
so a later headphones hint cannot hide it. Microphone renegotiation queues until
the current offer completes instead of creating overlapping local offers.

`tests/table-voice-recovery.spec.ts` reproduces fresh-settings ordering, repeated
remote retries and pending-offer negotiation. The Vercel helper's tests cover guest
credential exclusion, independently verified accounts and incomplete settings.
