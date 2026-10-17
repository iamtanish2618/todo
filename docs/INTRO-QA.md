# Introduction verification — 18 October 2026

`npm run typecheck` passed. `npm run test:e2e`: **16 passed**, including existing room, persistence, PDF, and API checks. AI transport tests use a mock provider; this first-page change does not enable live AI.

| Acceptance check | Evidence |
| --- | --- |
| Slow close → snow → hidden exchange → open | Browser checkpoints confirm closed lids, hidden/inert cards, fully opaque veil at progress .46/.48/.50/.52/.54, female reveal with a small opening overshoot, restored cursor tracking and character controls. Desktop/portrait screenshots inspected. |
| Reverse scroll | Layer opacity, lid transform, and snow density at .40 match when approaching from both directions. Moving flakes remain time-based, as specified. |
| Fast scroll and stop | Test jumps to the end, returns mid-transition, then reaches both endpoints without a stuck layer. |
| Resize mid-scroll | Cached cover-crop geometry is refreshed after pin recalculation. Both eye centers retain their configured natural-image fractions. |
| Live timing panel | `?debug=1` readout updates; moving the eye-opening slider rebuilds the same master timeline and preserves position. |
| Phone framing and keyboard | 390 × 844: both eyes remain on-screen, no horizontal overflow, PageDown scrolls natively, female choices open the shared room. |
| Reduced motion | No snow or scripted blink; a 600ms crossfade changes the companion and reverses correctly. |
| Console and layout stability | Performance runs captured **zero page errors and CLS 0** for both profiles. Art/font loading completes behind the loading overlay. |

## Chrome Performance recording

Recorded with `node scripts/profile-intro.mjs` against the local development server, scrolling the whole sequence down and back. Traces are in ignored `outputs/intro-desktop-trace.json` and `outputs/intro-portrait-trace.json`; load either into Chrome DevTools Performance. The machine-readable summary is `outputs/intro-performance.json`.

| Profile | Median frame interval | 95th percentile interval | Median frame rate | CLS |
| --- | --- | --- | --- | --- |
| 1440 × 960, DPR 1 | 16.659ms | 17.592ms | 60.0 FPS | 0 |
| 390 × 844, DPR 2, 4× CPU throttling | 16.665ms | 17.492ms | 60.0 FPS | 0 |

These are local headless Chromium measurements. They verify the implementation in this browser environment; they do **not** establish 60 FPS on a physical mid-range phone or Safari. That device check remains outstanding. The app reduces snow count first and DPR second if sustained frame timing exceeds its budget.
