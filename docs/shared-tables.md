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

The database contains temporary `tables/CODE/members`, recipient-specific `inbox` messages and private `tableClaims` ownership bindings. Nicknames are chosen for a table, not copied from account profiles. Email addresses and profile names are never in presence. Ownership uses private Firebase UIDs that other clients cannot read. Messages are removed after receipt or a short expiry fallback; presence and inboxes have server-side disconnect cleanup. This is temporary signaling storage, **not** a chat/history database. Audio and drawings are never recorded or archived. Drawings reset at the end of each break.

Room codes are shared invitations, not passwords. Verified users who know a code can see that table's nicknames and status. Root enumeration is denied. Capacity is enforced by clients, so a modified client can bypass that limit. Client rate limits are not a substitute for a server abuse service at larger scale. Firebase's free plan limits simultaneous connections/traffic; monitor usage before a public launch. The project has no paid billing enabled.

## Voice and network limits

Microphones start muted. Permission is requested only from Unmute. A listener can receive audio without granting mic access. Audio needs HTTPS (localhost is allowed). Each pair chooses the offerer by its random tab ID, negotiates a send/receive audio transceiver before any microphone is enabled, and uses replaceTrack on first enable. Later mute/unmute changes track.enabled. ICE queues until the remote description is ready. A failed connection gets one ICE restart.

Remote audio uses a hidden playsinline audio element plus a Web Audio gain for consistent per-person volume, including browsers where audio.volume is ineffective. A blocked AudioContext/playback exposes an Enable sound button. Speaking detection uses 512-sample RMS at 15Hz on GSAP's existing ticker. No microphone stream is created for that indicator alone.

Quiet table is on by default: focus mutes the mic, and a break restores the previous choice. Manual unmute during focus is allowed. Host requests can only mute, never enable another person's mic. Host migration follows current member order.

Default ICE server: `stun:stun.l.google.com:19302`. Some networks cannot establish direct peer-to-peer audio. Optional configuration:

```
TODO_TURN_URL=turns:YOUR_TURN_HOST:5349
TODO_TURN_USERNAME=YOUR_USERNAME
TODO_TURN_CREDENTIAL=YOUR_CREDENTIAL
```

Use short-lived TURN credentials for a larger deployment. These connection credentials necessarily reach voice clients. No TURN service has been provisioned and no paid relay is assumed. A managed SFU such as LiveKit can later replace `voice.ts` behind its existing UI interface; it is not a drop-in ICE URL.

## Behavior

Codes use `PENG-XXXXXX`, cryptographic randomness and a 32-character unambiguous alphabet. Join waits for presence and never creates a missing room. There are four admitted seats. Duplicate nicknames receive a number. The host is the earliest present member; host controls are verified against current presence. Joining a shared focus session is optional and uses the **existing timer** with a shared deadline. Already-started sessions are not overwritten.

The 3:2 room and complete oak table are preserved. Original penguins slide to percentage-based seats, wear their chosen knit color, and show an arrival nickname before settling into table name tags. The scene uses original assets only; the user's screenshot contributes layout guidance, not artwork.

Play appears only during a break. Window Doodle is clipped to the existing four window panes; normalized stroke batches are capped at 50 points, 20Hz per sender and 200 recent stroke IDs. Fog regrows gradually. Breathing Bubble has a 4-second inhale, 2-second hold and 6-second exhale for one calm minute; its tone is off by default. Late break participants can request the current activity and join optionally. Focused members never receive game invitations. Ending/skipping a break closes local game UI immediately and leaves other members' breaks alone. Games and speaking analysis share GSAP's ticker; no extra RAF loop is introduced.

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
5. Focus with a live mic: it auto-mutes. Enter a break and verify restoration. Check manual unmute remains possible.
6. Leave as host, then try next host's ask-to-mute, remove and close controls. A non-host must not control the room.
7. Host starts Sit together; consenting idle clients should share a deadline within 500ms. Declining or already-focusing clients keep their own work.
8. Disconnect/reconnect one browser. Presence returns, old voice connections are replaced and no orphan microphone remains after Leave.
9. **Real-device check required:** a phone on mobile data and a laptop on Wi-Fi. If audio fails, provision TURN; a local/emulator test cannot establish that a strict network will work.
10. Play is absent in idle/focus/recap and present in break. Share a doodle, clear it, join a breathing activity late, end one member's break and confirm only their game closes.
11. Test keyboard navigation, visible focus and OS reduced motion. Reduced motion uses fades and suppresses wave/sparkles/breathing transforms.
12. Recheck saved tasks, completed-task history, timer editing, notes/flashcards, three supplied looping audio recordings, Agent chat/attachments and quota behavior.

No automated test is a substitute for listening on two real devices with headphones. Cross-network audio, real permission revocation/unplugging and iOS hardware behavior must be checked on those devices.

## Completed verification for this update

- 14 shared-table checks passed in Chrome, using the real Firebase emulators/rules and real WebRTC with a synthetic microphone. Includes wrong/missing rooms, capacity, duplicate names, host migration/moderation, listening without capture, denied capture, incoming volume, reconnect recovery, real Todo invite entry, matching timer deadlines, shared doodles, late breathing joins, solo breaks and reduced motion.
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
