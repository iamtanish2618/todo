# Introduction verification — 18 October 2026

`npm run typecheck` passed. `npm run test:e2e`: **17 passed**, including existing room, persistence, PDF, and API checks. AI transport tests use a mock provider; this first-page change does not enable live AI.

| Acceptance check | Evidence |
| --- | --- |
| One long scroll / directional handover | A single wheel gesture of 0.85 viewport heights completes the 0.8-viewport travel. His registered artwork moves upward and hers arrives from below. Blue/pink knitted winter plates replace the code headbands. |
| Slow close → snow → hidden exchange → open | Browser checkpoints confirm natural feathered closed-eye artwork, hidden/inert cards, fully opaque veil at progress .46/.48/.50/.52/.54, female reveal with a small opening overshoot, restored cursor tracking and character controls. Desktop/portrait screenshots inspected. |
| Reverse scroll | Layer opacity, closed-eye blend opacity, and snow density at .40 match when approaching from both directions. Moving flakes remain time-based, as specified. |
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
| 1440 × 960, DPR 1 | 16.668ms | 17.814ms | 60.0 FPS | 0 |
| 390 × 844, DPR 2, 4× CPU throttling | 16.662ms | 17.481ms | 60.0 FPS | 0 |

These are local headless Chromium measurements. They verify the implementation in this browser environment; they do **not** establish 60 FPS on a physical mid-range phone or Safari. That device check remains outstanding. The app reduces snow count first and DPR second if sustained frame timing exceeds its budget.

The winter revision replaces the flat SVG lid discs with localized feathered windows onto matching closed-eye artwork. It reduces scroll travel from four viewport heights to 0.8 (80% less), changes scrub catch-up from 0.8s to 0.55s, and composes travel with breathing without overwriting either. The shorter range uses a one-pixel tolerance in automated progress checks, since mobile scroll coordinates round fractional target pixels.
