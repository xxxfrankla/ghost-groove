# Implementation Plan: Pure Engine

## Overview

Implement the four engine functions in `src/engine` as pure TypeScript, keep `types.ts` unchanged, and cover the behaviour with fixture behaviour tests and six fast-check property tests. Add a fixture regeneration script to run after tuning. Run tests with `npm run test:engine`.

## Tasks

- [x] 1. Add presets
  - Create `src/engine/presets.ts` with the constants (including `MIN_CONTRAST_SPAN = 48`, `SCAN_EPS = 12`, `SIGNAL_FLOOR`, `GHOST_VELOCITY`, `MAX_ACCENTS_PER_BAND`, `GHOST_MIN_DENSITY`, `DEFAULT_DENSITY`), `accentThreshold`, `ghostThreshold`, `MOODS`, scales, base grooves and register-to-octave mapping from the design
  - Hollow clap is `[12]`, Neon clap is `[4, 12]`
  - Give each mood a 16-entry `bassLine` of scale-degree indices (each 0..4) that indexes into `scaleOffsets`
  - Add a small helper to convert octave plus semitone offset to a pitch name (sharps) and to a pitch class
  - _Requirements: 3.2, 4.1, 4.2, 5.1, 5.3, 5.4, 5.5, 5.6, 5.7, 6.2, 6.3_

- [x] 2. Implement `analyzeImage`
  - [x] 2.1 Create `src/engine/analyze.ts` with integer luma, histogram percentiles, saturation, contrast, detailDensity, signalStrength and suggestedMood
    - Handle empty images
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_
  - [x] 2.2 Write unit tests in `src/engine/analyze.test.ts`
    - Black image, dark image with a bright gap, saturated vs grey image, empty image
    - _Requirements: 1.2, 1.3, 2.1, 2.3_

- [x] 3. Implement `scanBand`
  - [x] 3.1 Create `src/engine/scan.ts` with band geometry clamping, per-cell brightest-decile peak, median deviation and normalization
    - Return 16 zeros when the highest excess over the median is below `SCAN_EPS`
    - Otherwise divide each excess by `max(dmax, MIN_CONTRAST_SPAN)` so weak contrast stays below 1
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8, 3.9_
  - [x] 3.2 Write unit tests in `src/engine/scan.test.ts`
    - Lone bright cell (at least 48 luma above the rest) at index 11 scores 1 there and 0 elsewhere, flat band gives zeros, vertical move changes scores, out-of-image band, `register` echoes the clamped center
    - A band containing only ±6 luma noise gives all scores below `accentThreshold(100)`
    - A band over a dim gradient spanning under 48 luma levels gives all scores below `accentThreshold(100)`
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 4. Implement `generatePattern`
  - [x] 4.1 Create `src/engine/generate.ts` with `bandVelocities` (threshold, cap, tie-break, ghost gating) and the track B pitch and length rules
    - Track B step `i` pitch is `pool[bassLine[i]]` in the base octave from the B register
    - Include the Hollow drone and its cap adjustment
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 5.1, 5.2, 5.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2_
  - [x] 4.2 Write unit tests in `src/engine/generate.test.ts`
    - Hollow clap is exactly step 12 and Neon clap is steps 4 and 12
    - B pitches follow `bassLine` for both moods
    - Tie-break with 16 equal scores, ghost gating at density 24 vs 25, Hollow kick at 89 vs 90, register octaves, drone absent on low signal
    - _Requirements: 4.2, 4.3, 5.3, 5.4, 5.6, 5.7, 6.2, 6.3, 6.5, 7.1_

- [x] 5. Implement `resolvePattern`
  - [x] 5.1 Create `src/engine/resolve.ts` that deep-copies the pattern and applies valid overrides
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 5.2 Write unit tests in `src/engine/resolve.test.ts`
    - `on` keeps pitch and length, `off` drops length, invalid entries ignored, inputs not mutated
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [x] 6. Wire up `src/engine/index.ts`
  - Remove the fixtures import and stubs, re-export `types` and the four functions
  - Check that `src/audio/fakePlayer.ts` and `src/app` still compile (read only; report problems as TODOs instead of editing `src/ui` or `src/app`)
  - _Requirements: 9.2, 9.3, 9.4_

- [x] 7. Fixtures: behaviour tests and regeneration script
  - [x] 7.1 Create `src/engine/fixtures.test.ts` asserting behaviour at density 50, not deep equality with `fixture.pattern`
    - Run `generatePattern({ features, bands, mood: features.suggestedMood, density: 50 })` on `emptyLot`, `neonStreet` and `blackImage`
    - `emptyLot`: band A has exactly one step with velocity 1, at index 11, and no other A step above 0
    - `blackImage`: every A and B step has velocity 0
    - `neonStreet`: the count of A and B steps with velocity above 0 is greater than the same count for `emptyLot`
    - _Requirements: 10.1, 10.2, 10.3, 10.5_
  - [x] 7.2 Create `scripts/regen-fixtures.ts` and add the `regen:fixtures` npm script
    - Read `emptyLot.json`, `neonStreet.json` and `blackImage.json` in `src/fixtures`, recompute `pattern` with `generatePattern` (density `DEFAULT_DENSITY`, mood from `features.suggestedMood`), and write each file back with only `pattern` changed
    - Add `tsx` as a dev dependency (it is not installed) and add `"regen:fixtures": "tsx scripts/regen-fixtures.ts"` to `package.json` scripts
    - Keep the script out of the engine bundle and out of the test run; if `tsconfig.json` does not include `scripts`, do not add it to the app build
    - Run the script after tuning presets, not as part of tests
    - _Requirements: 10.4_

- [x] 8. Property-based tests
  - [x] 8.1 Create shared arbitraries in `src/engine/arbitraries.ts`
    - _Requirements: 9.1_
  - [x] 8.2 Write property test for determinism
    - **Property 1: Determinism**
    - **Validates: Requirements 9.1, 9.2**
  - [x] 8.3 Write property test for dark-safe behaviour
    - **Property 2: Dark-safe**
    - **Validates: Requirements 2.1, 2.2, 7.1, 7.2**
  - [x] 8.4 Write property test for monotonic density
    - **Property 3: Monotonic density**
    - **Validates: Requirements 4.5**
  - [x] 8.5 Write property test for the accent cap
    - **Property 4: Capped**
    - **Validates: Requirements 4.3, 4.4, 6.5**
  - [x] 8.6 Write property test for pitches in key
    - **Property 5: In key**
    - **Validates: Requirements 6.1**
  - [x] 8.7 Write property test for overrides winning
    - **Property 6: Overrides win**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5**

- [x] 9. Checkpoint
  - Run `npm run test:engine` and `npx tsc -b`; fix failures in engine code only
  - Ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "5.1"] },
    { "id": 2, "tasks": ["4.1", "2.2", "3.2", "5.2"] },
    { "id": 3, "tasks": ["4.2", "6"] },
    { "id": 4, "tasks": ["7.1", "7.2", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6", "8.7"] },
    { "id": 6, "tasks": ["9"] }
  ]
}
```

## Notes

- Do not edit `src/engine/types.ts`, `src/ui` or `src/app`. Report needed changes there as TODOs.
- Tests build `ImageData`-like objects (`{ width, height, data }`) because Vitest runs without a DOM.
- Property tests run at least 100 iterations each.
- Fixture tests check behaviour, so retuning presets does not break them. Run `npm run regen:fixtures` after tuning to refresh the fixture patterns for the UI.
