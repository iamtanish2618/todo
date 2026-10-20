# Focus pose assets

Created with the built-in image-generation tool; transparency preserved. Existing idle and writing assets are retained.

- Blue: `public/art/room-todo-focused-v1.png`
- Pink: `public/art/room-todo-focused-v1-pink.png`
- Both: 1254 × 1254 RGBA. The same centered canvas/shoulder placement as the existing idle sprite.

## Blue edit prompt

Use case: identity-preserve. Asset type: transparent seated character sprite for an existing cozy study website. Image 1 is the exact edit target, not a loose style reference. Change ONLY the head pose and gaze: this SAME penguin is calmly concentrating on a notebook below the bottom of the frame, chin lowered gently, head pitched forward about 12 degrees, both pupils clearly directed downward toward its lap, softly relaxed upper eyelids, small closed contented beak. Keep EXACTLY the original square canvas, camera distance, character scale and centered position, blue knitted hat and scarf, lighting, fur, seated body, feet and resting flippers. Shoulders must stay in the exact same place. Do not add a notebook, pencil, table, room, text or any props. Preserve transparent background. The head bow must be obvious at small size but natural, with the hat crown showing a little more and eyes looking down. Preserve identity and fluffy material, do not flatten or cartoonize.

Input: `public/art/room-todo-idle.png`.

## Pink edit prompt

Use case: precise-object-edit. Image 1 is the EXACT edit target: our seated penguin looking down, with its chin lowered and pupils focused on its lap. Image 2 is ONLY the color reference for the pink knitted hat and scarf. Change ONLY the blue hat and blue scarf in Image 1 to the exact soft pink knit colors of Image 2, with slightly rosier cheeks. Preserve EVERYTHING else in Image 1 identically: its downward head tilt, both downward-looking eyes, closed beak, shoulder positions, resting flippers, body, seated feet, fur, lighting, camera, square canvas, scale and placement. Do not add props, do not change the pose or gaze. Real transparent background. This is the female variant of the same animation sprite, so it must align perfectly with Image 1.

Inputs: the generated blue focus pose and `public/art/room-todo-idle-pink.png`.

## Animation integration

The focus sprites have no baked-in notebook or pencil. A small SVG mask samples the actual flipper fur from the same selected sprite, feathering the shoulder seam. The writing shoulder rotates around a fixed anchor; a separate pencil motion traces short phrases and lifts briefly to reset. The supporting flipper makes much smaller adjustments. The 8.4-second writing cycle contains pauses, and the 14.8-second supporting cycle avoids mirrored robotic movement. Cursor-driven eye patches are hidden while working so they cannot overwrite the focused gaze. Pausing crossfades back to idle. OS/device reduced motion retains the down-looking pose and disables cyclic movement.
