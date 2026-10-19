# Todo accounts: Google and email

Todo can use Firebase Authentication independently of ChatGPT. Google and email/password are the only enabled product providers; account verification, password-reset email, refresh tokens, and persistent browser sign-in are handled by Firebase's SDK. Todo never stores passwords.

## Firebase project and deployment

Firebase project `todo-penguin-26a9f3` (Todo) and its Todo web app are provisioned. Google sign-in and email/password are enabled; the production Site is public and both required hostnames are confirmed in Firebase; anonymous authentication is disabled. Analytics, Gemini, Firestore and Firebase Hosting are unnecessary: hosting and application records stay on Sites/D1.

The production runtime contains `TODO_AUTH_PROVIDER=firebase` and the four public web settings: `TODO_FIREBASE_API_KEY`, `TODO_FIREBASE_PROJECT_ID`, `TODO_FIREBASE_AUTH_DOMAIN`, `TODO_FIREBASE_APP_ID`. Local equivalents live only in ignored `.env.local`. Never supply service-account JSON or OAuth secrets to the browser. An unknown provider fails closed; missing Firebase settings cannot fall back to platform identity. Legacy platform mode requires an explicit `TODO_AUTH_PROVIDER=chatgpt`.

For a new setup or hostname change:

1. Select this existing project rather than creating a duplicate. Register/fetch the web SDK config through the Firebase tools.
2. Deploy providers with `npx -y firebase-tools@latest deploy --only auth --project todo-penguin-26a9f3`.
3. In [Authentication settings](https://console.firebase.google.com/project/todo-penguin-26a9f3/authentication/settings), add the exact hostnames `localhost` and `todo-penguin.aniketyadav982.chatgpt.site` under Authorized domains. **CLI 15.34.0 ignores the `auth.authorizedDomains` entry in firebase.json**, so provider deployment alone does not apply them. Preserve the two default Firebase hostnames.
4. Store the public web settings and provider mode in Sites runtime variables, then publish the matching source. Runtime changes require deployment.
5. The requested audience is public: the landing page should open without ChatGPT, while every private data API requires its own verified Firebase identity. Change hosting access only after the Firebase-mode source is deployed and anonymous data requests are rejected.
6. Test Google sign-in, refresh/restoration, logout, and email signup → verification → login → password reset. Mocked UI/cryptographic tests do not prove live email delivery.

The hosting workspace supplies `aniketyadav982` in the generated address. Renaming the Site slug changes `todo-penguin`, not that workspace label; no workspace rename/transfer is exposed by the Sites tools. A separate custom domain needs ownership and DNS setup.

## Security boundaries

- `lib/auth/verify-token.ts` uses Google's fixed public-key endpoint and verifies RS256 signatures, key ID, issuer, project audience, expiry, issue/auth times, subject, verified email and allowed provider. There is no unsigned emulator mode or configurable remote key URL.
- Firebase UIDs are namespaced as `firebase:<uid>`. Every task, note, focus session and profile query still uses a server-established owner ID.
- `/api/auth/session` sets an HttpOnly, Secure, SameSite=Lax `__Host-` cookie scoped to `/`, expiring no later than its verified one-hour ID token. Plain loopback HTTP has a separate development-only cookie. Creating/deleting sessions requires an exact Origin match.
- The Firebase SDK owns refresh credentials. ID-token changes refresh the SSR cookie. Normal API requests get a fresh verified-email bearer token from the SDK; a stale SSR cookie cannot extend a token's expiry.
- Account changes remount the app, dropping in-memory private lists and late request results. Firebase timers use per-UID device storage; guests do not hydrate a previous signed-in timer. Settings/companion preferences remain device-local.
- Email verification is required before a session or room is granted. Password reset uses a generic confirmation and does not reveal whether an email is registered. Keep Firebase email-enumeration protection enabled.
- Browser logout removes the Firebase local sign-in and the Todo cookie. Like Firebase's standard signature-verification flow, already issued ID tokens can remain valid until expiry; server-side disabled-user/revocation lookup is not implemented by this token verifier.
- Existing ChatGPT-owned D1 records are retained unchanged. They are **not** automatically reassigned based on email or display name. Moving earlier records to a new Firebase UID needs an explicit verified ownership-transfer step; the old mode requires explicit legacy configuration. No existing records or accounts have been deleted.

## Validation

`npm run typecheck` and `npm run test:e2e` (23 tests) passed during implementation; the two authentication tests were then rerun against Firebase mode. New tests exercise signed Google/password claims and reject wrong project/issuer, expired/future tokens, unverified email, anonymous providers, unknown signing keys, tampering, oversized tokens and unsigned JWTs. Session API tests reject cross-origin/missing-Origin mutations and fake tokens and check logout cookie protections.

Live production checks confirmed anonymous homepage HTTP 200, anonymous/forged-token data requests HTTP 401, cross-origin session mutation HTTP 403, and successful Google sign-in with a real verified account, including initial profile creation and room access. Email delivery/verification/reset with a real inbox still requires user testing.

The real LoginForm was also exercised in a local mock-controller fixture: Google popup cancellation, email signup → verification state, refusal to enter an unverified room, and generic reset confirmation. That fixture lives under ignored `work/` and is not a deployed authentication bypass. No test email was sent and no live Firebase account was registered by those UI checks.

Official references: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [email/password](https://firebase.google.com/docs/auth/web/password-auth), [email verification and reset](https://firebase.google.com/docs/auth/web/manage-users), [token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).
