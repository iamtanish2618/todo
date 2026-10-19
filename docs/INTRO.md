# Penguin introduction

## Run

From this project directory, run `npm install`, then `npm run dev -- --port 3000` and open the printed URL. See the main README for first-time local database setup. The introduction itself needs no API keys.

Open `http://localhost:3000/?debug=1` for the tuning panel. It shows timeline progress, snow count, DPR, and ticker frame timing. Sliders rebuild the one master timeline while preserving your current position. They are preview-only; copy final values into `INTRO_CONFIG.timings` to save them.

## Code and images

- `components/todo/welcome.tsx` contains the configuration, registered eye layers and natural blink patches, GSAP/ScrollTrigger timeline, Lenis integration, cursor tracking, fixed snow pool, and debug UI.
- `components/todo/welcome.css` contains the materials, typography, accessories, and responsive framing.
- The live base is the original playful avatar, `public/art/todo-face.webp`, shared by both companions. Its identity and camera framing are unchanged. `todo-cap-scarf-blue.webp` and `todo-cap-scarf-pink.webp` are transparent wardrobe overlays; they add only a knitted cap and muffler. `todo-face-closed.webp` supplies naturally closed eyes. The newer photographic winter portraits are superseded and are not used by this introduction.
- To substitute separate male/female images, place WebP/AVIF files in `public/art/`, set `INTRO_CONFIG.images.male.src` / `female.src` and each matching `closedSrc` and transparent `wardrobe`, and adjust each image's `scale`, `translateX`, and `translateY`. Offsets are fractions of the displayed image dimensions. Supply clean eye whites: baked-in pupils would remain visible behind the moving pupils.
- Eye coordinates are fractions of natural artwork dimensions. Adjust `eyes.leftEye` and `rightEye` (`cx`, `cy`, `rx`, `ry`) when replacing art. The loader decodes the base, closed-eye plate, and wardrobe overlays before revealing the stage. Cover-crop math is calculated on load and debounced resize.
- Portrait framing caps artwork width at 1.5 × viewport width and places the left eye at 41% of the viewport height. Soft edge masks blend into the extended background. This preserves both eyes on 390 × 844 screens rather than cropping them off. Tune `portrait` for different artwork.

## Timing and appearance

The 180svh wrapper supplies 0.8 screen-heights of scroll travel (80% less than the earlier four-screen travel) to one pinned stage. Fractions in `INTRO_CONFIG.timings` locate each beat within one timeline. `scrub: 0.55` smooths catch-up; Lenis uses `lerp: 0.09`, native touch scrolling, and GSAP's ticker. Increase section height for a slower story. Keep `whiteAt < whiteUntil`: the actual image exchange is inset by 0.012 on each side of that fully opaque interval.

`colors` controls the cool white veil. `interaction` controls cursor sway, tilt, reaction duration, and pupil reach. Instead of flat SVG lid discs, each eye uses a feathered SVG window into its matching naturally closed-eye artwork. The whole original socket rim is covered by the soft patch, so a closed eye has continuous fur and a delicate seam. Pupils subtly squish as the patch blends in, and recover with a small opening overshoot. Both eyes close and open in sync (`rightOffset: 0`); the opening overshoot is deliberately small.

He travels upward by 12% of the art height as the snow builds. She enters from 13% below her resting position and settles during the clearing snow and eye opening. Travel and breathing are separate numeric values composed into one transform in the shared ticker; neither overwrites the other, and both reverse with scrolling. Their eye tracking weights, look-around, breathing, and all scroll effects share the same timeline/ticker. Idle blinks are suspended during the transition. Particle motion remains time-based while density, wind, and swirl reverse with scrolling.

Clicking anywhere on the character or empty stage cycles a gentle wiggle, bounce, and nuzzle, with warmer cheeks and occasional floating hearts. Clicks explicitly suppress idle blinking; they never wink. The full character is a keyboard-accessible button, while clicks on interface controls retain their own actions. Reduced motion keeps only a small opacity-based blush response.

Cursor movement drives the smaller, shaded pupils, a gently damped character sway, and local background refraction. `lib/todo/art-lens.ts` implements a small native WebGL shader (no 3D library). One shared artwork canvas moves between the two registered planes under the whiteout. It shades only a small, softly feathered canvas window that follows the cursor and draws only when lens input changes and falls back to the ordinary artwork if WebGL is unavailable. The base and clothing are composited into two cached textures before animation. The lens changes texture only under the whiteout and leaves feathered holes for the live eyes. Knit layers also have a small secondary sway and elastic response to click reactions. The pastel atmosphere drifts in the opposite direction, and the header has a light cream wash instead of a black background. The snow canvas and artwork lens share the existing GSAP ticker; neither starts another animation loop.

Snow uses one visible canvas, one cached radial sprite, and a preallocated pool of 260 particles (120 below 640px). DPR is capped at 2. Under sustained frame pressure, it reduces particle count first, then DPR. Cards become invisible/inert before the heavy phase; their backdrop blur is disabled while hidden. Per-frame code uses cached measurements. Layout measurement occurs only at setup, refresh, and debounced resize.

Reduced motion replaces the blink/snow with a 600ms crossfade at the halfway point. Real buttons support keyboard focus; PageDown, Space, and arrow scrolling remain browser-native. The chosen companion is restored after decoding, before the loading overlay disappears.

## Verify

Run `npm run typecheck` and, with the dev server running, `npm run test:e2e`. `tests/intro.spec.ts` checks the hidden swap, reverse state equivalence, rapid scrolling, resize registration, live timing changes, keyboard scrolling, portrait eye visibility, and reduced motion. The home has one Focus with Todo invitation; AI, Friends, and Notes are reached from the room dock. Account tests cover real sign-in navigation, persisted names, returning greetings, mascot reactions, and API authorization/validation. Other tests still cover room/backend behavior.

For performance recording, run `node scripts/profile-intro.mjs` for the scroll story, and `node scripts/profile-intro.mjs --pointer` for sustained cursor motion and click reactions. Keep the dev server running. It saves Chrome tracing JSON and a summary under ignored `outputs/`. Load a trace in Chrome DevTools Performance to inspect frames. Browser-emulated phones are useful checks, but they do not establish performance on a physical mid-range phone; test the published version on one before claiming that device target.

## Minimal home and accounts

The first page contains a small account navigation, Choose Him / Choose Her labels, a polite greeting, and one Focus with Todo invitation per companion. The two trays are independently faded and made inert during the snow handover. No AI or Friends launch cards remain on the home screen. `components/todo/account-panel.tsx` uses the existing shadcn dialog, inputs, labels, and buttons. Its inline vector penguin moves between the name and verified-email fields and celebrates only after a successful save.

Authentication stays with the Sites platform: anonymous users follow a normal top-level sign-in anchor, and all user-data endpoints reject missing identity. The production site remains owner-private, so platform sign-in precedes this screen. `PUT /api/profile` validates and saves only a preferred name, keyed by the server-established user ID. A reload reads that profile back to show Welcome back. There is no separate password/session stack or simulated social-login button.
