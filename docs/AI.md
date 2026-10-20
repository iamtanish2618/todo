# Todo AI connection

Todo is intended for adults aged 18+, as confirmed by the owner. The account using Gemini API must also meet Google's age and regional requirements. The visitor needs a Todo account, not a Google AI Studio or ChatGPT account.

## What the owner provides

1. An eligible Google AI Studio account/project with free-tier API quota. Keep Google Cloud billing disabled if API use must remain free.
2. A Gemini API key generated in https://aistudio.google.com/api-keys . The owner copies it into `TODO_AI_API_KEY=` in the ignored `.env.local` file and saves. Do not paste it in chat, public forms, source files or screenshots.
3. Confirmation when the key is saved, so it can be privately configured in the hosted runtime and verified. The local file is never deployed automatically.

Prepared server settings (checked against Google documentation on 2026-10-20):

```text
TODO_AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
TODO_AI_MODEL=gemini-3.6-flash
TODO_AI_LABEL=Gemini
TODO_AI_VISION=true
TODO_AI_DAILY_LIMIT=25
```

The owner supplied the key privately during setup. A real Gemini 3.6 Flash adapter request returned a study answer; Gemini 3.8 Flash returned HTTP 503/high demand, so the configured model was changed to the documented free-tier Gemini 3.6 Flash. No paid fallback or billing was enabled. The endpoint, model and vision settings remain private configuration. `api/status` exposes readiness, friendly label and allowance, never the key. Runtime entries must preserve existing Firebase settings. No billing is enabled and no paid-model fallback is used. Per-user request limits are separate from Google's project-wide quotas and do not guarantee capacity for a public app. Unpaid Gemini input/output can be used by Google to improve products; confidential material should not be sent on that tier.

## Chat experience

Agent mode hides ordinary tools and the interactive clock, stops any visible YouTube recording, and zooms the room 1.035×. The single bottom panel keeps separate user/Todo message bubbles. The cream composer and brown arrow share the landing invitation’s subtle magnetic movement. Attach and Speak are icons whose labels expand on hover or keyboard focus. There is no mode dropdown: requests such as summaries and notes are typed into normal chat. The panel supports typed conversation, a text/Markdown attachment (70 KB / 18,000 characters), or PNG/JPEG/WebP (3 MB). Text attachments append to the draft; an image is passed with the next message only when vision is enabled. Enter sends; Shift+Enter inserts a newline; IME composition never submits prematurely. Browser dictation transcribes into the draft for review and never auto-sends. Support and language depend on the browser; speech may be processed by the browser's speech service. This is not real-time audio conversation or spoken AI replies.

Todo changes to typing only while an authenticated `/api/chat` request is pending. Stop cancels a reply and restores the draft. Back to room/Escape abort the request and dictation and restore tools. Unconfigured, denied-microphone, unsupported-browser, error and exhausted-quota states remain explicit. Messages are held only in the current open chat; this version does not add persistent chat history, embeddings, browsing, code execution, or external app tools. Answers can be saved privately as notes or exported as PDF.

## Verification and sources

The AI SDK adapter and error paths have mocked-transport tests. UI tests mock only the model/recognition boundaries and exercise real browser actions. A real provider test requires a supplied key and sufficient free quota; never claim live inference based only on mocks.

- API keys: https://ai.google.dev/gemini-api/docs/api-key
- OpenAI-compatible endpoint: https://ai.google.dev/gemini-api/docs/openai
- Current model pricing/free tier: https://ai.google.dev/gemini-api/docs/pricing
- Account, audience and data terms: https://ai.google.dev/gemini-api/terms
