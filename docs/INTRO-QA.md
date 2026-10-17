# Introduction verification — 18 October 2026

`npm run typecheck` passed. `npm run test:e2e`: **18 passed**. The final introduction suite also passed **6/6** after render optimizations, including existing room, persistence, PDF, and API checks. AI transport tests use a mock provider; this first-page change does not enable live AI.

| Acceptance check | Evidence |
| --- | --- |
| One long scroll / directional handover | A single wheel gesture of 0.85 viewport heights completes the 0.8-viewport travel. His registered artwork moves upward and hers arrives from below. The unchanged original avatar uses separate transparent blue/pink cap-and-muffler layers. |
| Cursor and whole-character reactions | Real pointer events change the character transform and increase native WebGL draw counts. Either cheek and keyboard activation trigger wiggle/bounce/nuzzle responses, warmer blush and hearts. Both closed-eye patches remain at opacity 0 after clicks. The shared lens follows the selected avatar. |
| Slow close → snow → hidden exchange → open | Browser checkpoints confirm natural feathered closed-eye artwork, hidden/inert cards, fully opaque veil at progress .46/.48/.50/.52/.54, female reveal with a small opening overshoot, restored cursor tracking and character controls. Desktop/portrait screenshots inspected. |
| Reverse scroll | Layer opacity, closed-eye blend opacity, and snow density at .40 match when approaching from both directions. Moving flakes remain time-based, as specified. |
| Fast scroll and stop | Test jumps to the end, returns mid-transition, then reaches both endpoints without a stuck layer. |
| Resize mid-scroll | Cached cover-crop geometry is refreshed after pin recalculation. Both eye centers retain their configured natural-image fractions. |
| Live timing panel | `?debug=1` readout updates; moving the eye-opening slider rebuilds the same master timeline and preserves position. |
| Phone framing and keyboard | 390 × 844: both eyes remain on-screen, no horizontal overflow, PageDown scrolls natively, female choices open the shared room. |
| Reduced motion | No snow or scripted blink; a 600ms crossfade changes the companion and reverses correctly. |
| Console and layout stability | Performance runs captured **zero page errors and CLS 0** for both profiles. Art/font loading completes behind the loading overlay. |

## Chrome Performance recording

Recorded with `node scripts/profile-intro.mjs` against the local development server, scrolling the whole sequence down and back. Traces are in ignored `outputs/intro-desktop-trace.json` and `outputs/intro-portrait-trace.json`; load either into Chrome DevTools Performance. The machine-readable summaries are `outputs/intro-performance.json` and `outputs/intro-pointer-performance.json`. The pointer run records continuous shader rendering and repeated reactions, not just an idle character.

| Mode | Profile | Median frame interval | 95th percentile interval | Median frame rate | CLS |
| --- | --- | --- | --- | --- | --- |
| Scroll | 1440 × 960, DPR 1.00 | 16.671ms | 17.575ms | 60.0 FPS | 0 |
| Scroll | 390 × 844, DPR 2.00, 4× CPU throttle | 16.667ms | 17.546ms | 60.0 FPS | 0 |
| Cursor + click reactions | 1440 × 960, DPR 1.00 | 16.663ms | 17.241ms | 60.0 FPS | 0 |
| Cursor + click reactions | 390 × 844, DPR 2.00, 4× CPU throttle | 16.667ms | 17.585ms | 60.0 FPS | 0 |

These are local headless Chromium measurements. They verify the implementation in this browser environment; they do **not** establish 60 FPS on a physical mid-range phone or Safari. That device check remains outstanding. The app reduces snow count first and DPR second if sustained frame timing exceeds its budget.

The current avatar revision replaces the flat SVG lid discs with localized feathered windows onto matching closed-eye artwork. It reduces scroll travel from four viewport heights to 0.8 (80% less), changes scrub catch-up from 0.8s to 0.55s, and composes travel with breathing without overwriting either. The shorter range uses a one-pixel tolerance in automated progress checks, since mobile scroll coordinates round fractional target pixels.

The original avatar base is preserved byte-for-byte. Clothing is a transparent accessory layer, rather than a replacement portrait. The lens uses a small canvas window with a softly transparent edge. Raster-edge masks are applied to static image layers instead of flattening the whole live character subtree, keeping cursor movement fast. Motion preferences hydrate before engine startup, and normalized timeline values retain their starts on refresh. Veil opacity is applied from the timeline’s numeric state to keep forward/reverse rendering consistent.

Scroll anchoring is disabled inside the pinned story. Automated programmatic seeks wait two browser frames after live tuning so Lenis can finish its immediate-position restore; real wheel input uses Lenis’s regular virtual-scroll path.
