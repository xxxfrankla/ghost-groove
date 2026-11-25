# Requirements Document

## Introduction

The pure engine turns a photo and a few user settings into a 16-step pattern. It replaces the fixture stubs in `src/engine/index.ts` with real `analyzeImage`, `scanBand`, `generatePattern` and `resolvePattern` implementations that follow `src/engine/types.ts` and the README sections "Two scan bands", "Mood and density" and "Hard photos". These requirements are derived from `design.md`.

## Glossary

- **Engine**: the pure TypeScript code in `src/engine`, with no DOM access and no randomness.
- **Band**: a horizontal strip of the photo, identified as A or B, cut into 16 cells.
- **Score**: a number in 0..1 that says how much a cell stands out from the rest of its band.
- **Accent**: a step with velocity 1.
- **Ghost note**: a step with velocity 0.45.
- **Signal floor**: the signal strength value 0.1, below which the photo layers are silent.
- **Regeneration_Script**: the Node script `scripts/regen-fixtures.ts`, which is not part of the engine bundle and is not run by tests.
- **Step index**: a 0-based position from 0 to 15.

## Requirements

### Requirement 1: Image features

**User Story:** As a player, I want the whole photo to describe its mood, so that the music matches how the picture feels.

#### Acceptance Criteria

1. WHEN `analyzeImage` receives an image, THE Engine SHALL return saturation, contrast, detailDensity and signalStrength, each in the range 0 to 1.
2. WHEN `analyzeImage` receives an image with zero pixels, THE Engine SHALL return all numeric features as 0 and `suggestedMood` as `hollow`.
3. WHEN the weighted sum of saturation (0.45), contrast (0.30) and detailDensity (0.25) is at least 0.5, THE Engine SHALL set `suggestedMood` to `neon`, and otherwise to `hollow`.

### Requirement 2: Hard photos

**User Story:** As a player, I want dark, blurry or noisy photos to behave sensibly, so that silence only happens when the photo has nothing to say.

#### Acceptance Criteria

1. WHEN an image is fully black or has channel values of at most 2, THE Engine SHALL report a signalStrength below 0.1.
2. WHEN an image of at least 256 pixels consists of independent uniform random pixels, THE Engine SHALL report a signalStrength below 0.1.
3. WHEN an image is dark but contains a small bright region, THE Engine SHALL report a signalStrength of at least 0.1, because signal is measured from local luma spread and not from absolute brightness.

### Requirement 3: Band scanning

**User Story:** As a player, I want each band to read 16 cells of the photo, so that a bright spot under the band becomes a hit on that step.

#### Acceptance Criteria

1. WHEN `scanBand` is called, THE Engine SHALL return exactly 16 scores in the range 0 to 1 and a `register` equal to the band center clamped to 0..1.
2. WHEN at least one cell stands out from the band median by the scan epsilon (12 luma levels) or more, THE Engine SHALL divide each cell's excess over the band median by the larger of the highest excess and the minimum contrast span (48 luma levels).
3. WHEN the highest excess over the band median is at least 48 luma levels, THE Engine SHALL return a highest score of exactly 1.
4. WHEN the highest excess over the band median is at least 12 and below 48 luma levels, THE Engine SHALL return a highest score below 1.
5. WHEN no cell stands out from the band median by 12 or more luma levels, THE Engine SHALL return 16 scores of 0.
6. WHEN a band contains only luma noise of plus or minus 6 levels, THE Engine SHALL return 16 scores all below the accent threshold at density 100 (0.5).
7. WHEN the luma values of all cells in a band span fewer than 48 levels, THE Engine SHALL return 16 scores all below the accent threshold at density 100 (0.5).
8. WHEN the band lies partly or fully outside the image, THE Engine SHALL clamp it to the image and use at least one pixel row.
9. WHEN a band is dragged to another part of the photo, THE Engine SHALL compute scores only from the pixels under the new band.

### Requirement 4: Accents, ghost notes and density on bands A and B

**User Story:** As a player, I want density to decide how many cells play, so that I can move between quiet and crowded grooves.

#### Acceptance Criteria

1. WHEN a cell score is at least the accent threshold `0.8 - 0.3 * density / 100`, THE Engine SHALL treat the cell as an accent candidate.
2. WHILE density is at least 25, WHEN a cell score is at least the ghost threshold `0.6 - 0.4 * density / 100` and the cell is not an accent, THE Engine SHALL set its velocity to 0.45.
3. WHEN more than 6 cells of a band qualify as accents, THE Engine SHALL keep the 6 highest scores, break ties by the lower step index, and give every other candidate velocity 0.45 when ghost notes are enabled and 0 when they are not.
4. THE Engine SHALL produce at most 6 steps with velocity 1 on each of tracks A and B in one pattern.
5. WHEN density is raised and all other inputs stay the same, THE Engine SHALL NOT lower the velocity of any step on tracks A and B.
6. WHEN density is below 0 or above 100, THE Engine SHALL clamp it to the range 0 to 100.

### Requirement 5: Mood presets and base groove

**User Story:** As a player, I want each mood to have its own base groove, so that the photo's character is audible even when the bands are quiet.

#### Acceptance Criteria

1. THE Engine SHALL return `pattern.mood` equal to the requested mood and a `pattern.bpm` from that mood's preset.
2. THE Engine SHALL return 16 steps on each of tracks kick, clap, A and B.
3. WHILE the mood is `hollow` and density is below 90, THE Engine SHALL place kick hits on steps 0 and 8.
4. WHILE the mood is `hollow` and density is at least 90, THE Engine SHALL place four kick hits per bar, on steps 0, 6, 8 and 14.
5. WHILE the mood is `neon`, THE Engine SHALL place kick hits on steps 0, 4, 8 and 12.
6. WHILE the mood is `hollow`, THE Engine SHALL place a single clap hit on step 12.
7. WHILE the mood is `neon`, THE Engine SHALL place clap hits on steps 4 and 12.
8. THE Engine SHALL produce the same kick and clap tracks regardless of the photo.

### Requirement 6: Track B pitches

**User Story:** As a player, I want the pitched layer to stay in key, so that dragging a band never sounds wrong.

#### Acceptance Criteria

1. THE Engine SHALL set a `pitch` on every step of track B, including steps with velocity 0, and the pitch class of every pitch SHALL belong to the mood's scale.
2. WHEN the B band register is 0.5 or more, THE Engine SHALL use base octave 2; WHEN it is at least 0.25 and below 0.5, octave 3; otherwise octave 4.
3. THE Engine SHALL assign to each step `i` of track B the pitch `scale[bassLine[i]]` in the base octave, where `bassLine` is the mood's 16-entry list of scale degrees and every entry is an integer from 0 to 4.
4. WHILE the mood is `neon`, THE Engine SHALL give every step of track B length 1.
5. WHILE the mood is `hollow` and the signal is at or above the signal floor, THE Engine SHALL play a drone on step 0 of track B with velocity 1, the root pitch and length 16, and count it toward the cap of 6 accents.
6. WHILE the mood is `hollow`, THE Engine SHALL give steps of track B with velocity above 0 (other than step 0) length 1, and steps with velocity 0 no length.

### Requirement 7: Low signal fallback

**User Story:** As a player, I want a near-black or noisy photo to keep the base groove and go quiet elsewhere, so that silence is intentional.

#### Acceptance Criteria

1. WHEN `features.signalStrength` is below 0.1, THE Engine SHALL set velocity 0 on every step of tracks A and B.
2. WHEN `features.signalStrength` is below 0.1, THE Engine SHALL still return the mood's kick and clap tracks unchanged.

### Requirement 8: Override resolution

**User Story:** As a player, I want my manual edits to win over the photo, so that my changes stay put while the photo keeps changing everything else.

#### Acceptance Criteria

1. WHEN an override is `on` for a valid track and step, THE Engine SHALL set that step's velocity to 1 and keep its pitch.
2. WHEN an override is `off` for a valid track and step, THE Engine SHALL set that step's velocity to 0, keep its pitch and remove its length.
3. THE Engine SHALL leave every step without a valid override deeply equal to the auto pattern.
4. WHEN an override names an unknown track, a step outside 0..15, a non-integer step, or a value other than `on` or `off`, THE Engine SHALL ignore it.
5. THE Engine SHALL return a new pattern and SHALL NOT mutate the auto pattern or the overrides.

### Requirement 9: Purity and determinism

**User Story:** As a developer, I want the same input to always give the same output, so that the UI and tests can rely on the engine.

#### Acceptance Criteria

1. WHEN `analyzeImage`, `scanBand`, `generatePattern` or `resolvePattern` is called twice with equal inputs, THE Engine SHALL return deeply equal results.
2. THE Engine SHALL NOT use randomness, clocks, the DOM, or global mutable state.
3. THE Engine SHALL NOT modify `src/engine/types.ts`.
4. THE Engine SHALL NOT import from `src/ui`, `src/app` or `src/fixtures` in production code.

### Requirement 10: Fixture regression

**User Story:** As a developer, I want the existing fixtures to keep passing, so that the UI team's stub data stays truthful.

#### Acceptance Criteria

1. WHEN `generatePattern` is called with the `features` and `bands` of `emptyLot`, the fixture's `suggestedMood` and density 50, THE Engine SHALL return exactly one step with velocity 1 on track A, at step index 11, and no other step above 0 on track A.
2. WHEN `generatePattern` is called with the `features` and `bands` of `blackImage`, the fixture's `suggestedMood` and density 50, THE Engine SHALL return velocity 0 on every step of tracks A and B.
3. WHEN `generatePattern` is called with the `features` and `bands` of `neonStreet`, the fixture's `suggestedMood` and density 50, THE Engine SHALL return more steps with velocity above 0 on tracks A and B combined than for `emptyLot` under the same conditions.
4. WHEN the regeneration script `scripts/regen-fixtures.ts` runs, THE Regeneration_Script SHALL recompute the `pattern` of `emptyLot`, `neonStreet` and `blackImage` with `generatePattern` at density 50 and the fixture's `suggestedMood`, and write each fixture file with only `pattern` changed.
5. WHEN `src/engine` files are saved, THE test suite (`npm run test:engine`) SHALL run the fixture and property tests.
