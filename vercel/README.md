# Todo on Vercel

Production: https://sit-with-todo.vercel.app/

Vercel project: `sit-with-todo`, owned by `iamtanish2618-3571s-projects`.
Deployment: `dpl_BakYRuwrSHT4CLEuLpwuhD8U1gaY`.

Verified: anonymous homepage 200; Google/email login UI; Firebase authorized
domain saved; API session GET/DELETE; unauthenticated task access rejected;
shared-table configuration enabled; audio and KaTeX assets available; six proxy
boundary tests and production build pass. A full user login and saved-record
round trip are not yet verified: Google popup sign-in reported a connection
error in the in-app browser. Firebase's public project-config endpoint accepts
the new domain (HTTP 200); this is not an unauthorized-domain response.
Test Google sign-in in a regular browser before treating authentication as
fully verified. No passwords or user tokens were collected for testing.

Native Next.js deployment of Todo's existing interface, exported from the working
Sites source at commit `f30f955816fcc537af6a5165d0014a555820226a`.
The original artwork, animations, audio loops, Firebase accounts, and shared
table client are preserved. This directory is independent of the Sites checkout.

## Run and deploy

1. `npm ci`
2. Link the intended Vercel project and verify its owner with `vercel project inspect`.
3. Configure the variables in `.env.example` in Vercel. Copy public Firebase web
   settings from the same existing Firebase project, not service-account keys.
4. `vercel env pull .env.local` (development configuration only).
5. `npm run dev`, or `npm run build && npm start`.
6. `npm test` checks the API bridge's origin, identity, cookie, body size, and
   destination boundaries. `npm run typecheck` checks the app.
7. Add the final hostname in Firebase Authentication's Authorized domains.
8. Stage a production deployment, test it, then promote it and assign the hostname.

## Data and AI architecture

Vercel hosts the UI and a bounded same-origin API bridge. The existing backend at
`https://todo-penguin.aniketyadav982.chatgpt.site` continues to own the database,
AI provider key, authenticated record access, and quotas. **Keep that backend live.**
This release does not migrate D1 or duplicate saved user data. No AI secrets are
copied into this project. Friend tables still connect to the existing Firebase
Realtime Database using each user's Firebase identity.

`lib/server/backend-proxy.mjs` allowlists each route and method, checks write
origins, forwards only Firebase identity, rejects redirects, limits uploads, and
marks all API responses private/no-store. The backend also independently verifies
Firebase tokens and checks record ownership. For a future backend migration,
export/import data deliberately and replace this bridge after integration tests.

The build prepares KaTeX's fonts with stable public URLs, preserving math in AI
replies. Asset paths remain under `/art`, `/audio`, and `/fonts`.


## Shared room update — 22 October 2026

Room/UI modules are synchronized with Sites source commit
`afeeec01ef951e1d1e11203cbcf6e6fb5b05d134` (Sites v35). The Vercel API bridge
and Firebase-only server authentication remain intact. Firebase database rules
now validate the optional, owned `companion` field.

The update adds session-only table chat and ten-second previews, saved game
invitations with current-game checks, preserves the chosen female avatar, moves
the timer to the wall, and removes the plant/picture interactions. Voice uses
native media playout; remote speaking indicators read decoded RTP levels.

Validation: 13 focused room/Firebase tests passed across final targeted runs,
including bidirectional decoded audio with synthetic microphones, ordinary
autoplay, listener-only and denied-microphone paths, reconnect, shared-game
switching/history, two-way chat/preview expiry and female companion persistence.
Both production builds and six API-bridge tests passed. Physical speakers and
calls across unrelated networks were not tested; TURN is not configured.
Chat retains at most 200 entries for the current browser table session and clears
on leaving; it does not restore a permanent history after a reload.

## Voice relay update — 22 October 2026

The backend now provides Open Relay / Metered ICE settings only after verifying
a Todo account. The scoped provider API key stays in the Sites backend's private
configuration, never in this deployment. The client sends its fresh Firebase token
when requesting room configuration, refreshes it during long sessions, and updates
existing peer connections. See `../docs/shared-tables.md` in the combined GitHub
repository for setup and the owner-run forced-relay check.

Validated: nine relay/protocol tests, six API bridge tests, both production builds,
and live bidirectional synthetic audio forced through UDP TURN and TLS TURN on
port 443. Physical microphones across unrelated networks still need a friend test.
The selected no-card provider trial lists 500 MB; no card or automatic reload was
configured. The provider dashboard is authoritative for remaining usage.

## Voice delivery repair — 22 October 2026

The native `/api/rooms/config` route now independently verifies Todo's Firebase
identity before appending Vercel's own private, validated TURN settings. The
legacy backend remains responsible for tasks, notes and AI; a missing relay in
its proxied configuration no longer prevents native Vercel voice. Configure
`TODO_TURN_URL`, `TODO_TURN_USERNAME`, and `TODO_TURN_CREDENTIAL` as production
Secrets without any `NEXT_PUBLIC_` prefix. The currently selected route uses
Metered TURN over TLS/TCP on port 443. Guests never receive relay credentials.

Reconnect refreshes configuration first, repeated manual remote retries are no
longer ignored, and microphone renegotiation waits for the current offer. The
reconnect control remains available when the connection has failed even if a
headphones hint replaces its status text. Existing tabs must refresh to load
these changes.

Validated: the owner's actual signed-in Chrome session receives the TLS relay;
an anonymous production request receives no relay. Nine native backend/config
tests and twelve shared protocol/relay/recovery checks passed. The prior live
forced-TLS synthetic audio check passed again during investigation. The owner confirmed actual two-way microphone playback after both users refreshed,
rejoined and unmuted: Chrome on the owner’s Mac and Microsoft Edge on the
friend’s Lenovo laptop. This confirms that live test, not universal network compatibility.
