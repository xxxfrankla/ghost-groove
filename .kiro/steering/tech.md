# Tech Stack

- **Build and UI:** Vite + React + TypeScript.
- **Image analysis:** Canvas 2D pixel sampling. The UI downscales photos to `ANALYSIS_WIDTH` (256) before analysis.
- **Audio:** Tone.js (Web Audio). `Player.start()` must be called from a user gesture (the Play click).
- **Testing:** Vitest + fast-check (property-based tests for the engine).
- **No server.** Everything runs in the browser. Photos never leave the user's machine.

## Engine rules
- `src/engine` is pure TypeScript with no DOM access, so it is testable in Vitest without a browser.
- `src/engine/types.ts` is the contract between engine/audio and UI. Change it only by agreement.
- Engine functions: `analyzeImage`, `scanBand`, `generatePattern`, `resolvePattern`. Audio: `createPlayer`.
- No randomness. Same input must give the same `Pattern`.
- Track B carries a pitch on every step, even silent ones, so an `'on'` override can reuse it.

## Properties to test (fast-check)
- Deterministic: same input gives the same pattern.
- Dark-safe: black or noise-only images keep the base groove and silence bands A and B.
- Monotonic density: raising density never removes a note the photo already played.
- Capped: at most 6 accents per band per bar.
- In key: every track B pitch belongs to the mood's scale.
- Overrides win: after `resolvePattern`, every override is honoured and all other steps match the auto pattern.

## Repository conventions
- `.kiro/` is committed and must never be added to `.gitignore`.
- Built-in photos live in `public/scenes/`, drum samples in `public/samples/` (CC0 or original).
