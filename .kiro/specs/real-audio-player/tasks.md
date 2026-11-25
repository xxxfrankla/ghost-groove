# Implementation Plan: Real Audio Player

## Overview

Implementation is in TypeScript. Work proceeds bottom-up: sound settings, then the pure scheduling module with its tests, then the Tone integration, then wiring into `createPlayer`, then the dev listening page. `src/engine/types.ts` is not modified, and `createFakePlayer` stays exported.

## Tasks

- [ ] 1. Create sound settings module
  - Create `src/audio/instruments.ts` as plain data with no runtime Tone import
  - Export `VoiceId`, `VELOCITY_CURVE`, `DRONE_MIN_STEPS`, `GATE`, `MASTER`, `LOOKAHEAD_S`, `KICK`, `CLAP`, `HOLLOW_METAL`, `NEON_HAT`, `HOLLOW_DRONE`, `HOLLOW_BASS`, `NEON_BASS` with the starting values from the design
  - Confirm the file is importable from Vitest in Node
  - _Requirements: 6.3, 7.3_

- [ ] 2. Implement pure scheduling module
  - [ ] 2.1 Implement step planning helpers in `src/audio/schedule.ts`
    - Export `NoteEvent`, `ScheduleState`, `DroneCommand`, `Advance`
    - Implement `velocityToGain` (clamp 0..1, NaN as 0, `velocity ** VELOCITY_CURVE`)
    - Implement `voiceFor`, `planStep`, `planDrone`, `barHasDrone`
    - Apply lenient validation: skip velocity <= 0, skip track B without pitch, clamp length to 1..16, tolerate short tracks
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 8.1, 12.1, 12.3_

  - [ ] 2.2 Implement state transitions in `src/audio/schedule.ts`
    - Export `initialState`, `queuePattern`, `queueMood`, `advance`, `stopState`
    - `queuePattern` also sets pending mood to the pattern's mood; queue functions apply immediately when not running
    - `advance` promotes pending values only at step 0, returns `bpm` only on pattern promotion, and produces `trigger`, `hold`, `release`, `none` per the design pseudocode
    - `stopState` clears `drone` and keeps pattern, mood and pending values
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.6, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 11.2_

  - [ ]* 2.3 Write property test for bar-boundary only
    - **Property 1: Bar-boundary only**
    - **Validates: Requirements 4.4**

  - [ ]* 2.4 Write property test for promotion at bar start
    - **Property 2: Promotion at bar start**
    - **Validates: Requirements 4.2, 4.5**

  - [ ]* 2.5 Write property test for no events from silence
    - **Property 3: No events from silence**
    - **Validates: Requirements 5.1**

  - [ ]* 2.6 Write property test for gain mapping
    - **Property 4: Gain mapping**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 2.7 Write property test for drone isolation
    - **Property 5: Drone isolation**
    - **Validates: Requirements 7.3, 7.4, 8.1**

  - [ ]* 2.8 Write property test for purity
    - **Property 6: Purity**
    - **Validates: Requirements 5.6**

  - [ ]* 2.9 Write property test for drone sustain
    - **Property 8: Drone sustain**
    - **Validates: Requirements 8.2**

  - [ ]* 2.10 Write property test for drone retrigger conditions
    - **Property 9: Drone retrigger conditions**
    - **Validates: Requirements 8.3**

  - [ ]* 2.11 Write property test for drone release
    - **Property 10: Drone release**
    - **Validates: Requirements 8.4, 8.5, 8.6**

  - [ ]* 2.12 Write property test for drone restart and mood change
    - **Property 11: Drone restart and mood change**
    - **Validates: Requirements 8.3, 8.5, 8.7**

  - [ ]* 2.13 Write property test for drone state invariant
    - **Property 12: Drone state invariant**
    - **Validates: Requirements 5.6, 8.8**

  - [ ]* 2.14 Write unit tests for the scheduling module
    - Create `src/audio/schedule.test.ts` (shared by the property tasks above) with example tests for `voiceFor`, `planStep` ordering and clamps, `queuePattern`/`queueMood`, and multi-bar drone continuity (first trigger, pitch change, signal drop, Hollow to Neon to Hollow, `stopState`)
    - Reuse `src/engine/arbitraries.ts` for patterns
    - _Requirements: 4.1, 4.2, 4.3, 5.2, 5.3, 5.5, 7.1, 7.2, 8.2, 8.3, 8.4, 8.5, 8.7, 12.3_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Tone integration
  - [ ] 4.1 Create `src/audio/tonePlayer.ts` with group construction
    - Define `TonePlayer = Player & { dispose(): void }` and `createTonePlayer()`
    - Build shared (kick, clap with bandpass filter), Hollow (metal, drone, bass, reverb) and Neon (hat, bass) groups routed through a shared `Tone.Limiter` to `Destination`, using settings from `instruments.ts`
    - Build exactly once; await reverb `ready`; dispose partial groups if building fails
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.5_

  - [ ] 4.2 Implement `start`, `stop`, `dispose`, `setPattern`, `setMood`
    - `start()` is non-async: dispose check, dedupe on `starting`, resolved if running, then `Tone.start()` synchronously before any await, assign `starting = run(toneReady)`, clear it in `finally`
    - `run` awaits `Tone.start()`, builds groups on first start only, sets bpm, schedules `scheduleRepeat(tick, '16n', 0)` once and starts the Transport at `LOOKAHEAD_S`
    - `stop()` stops and cancels the Transport and Draw, releases sustained voices, resets step and bar, applies `stopState`, keeps groups and pending values
    - `dispose()` calls `stop()`, clears listeners, disposes all nodes and the limiter, is idempotent, and makes later `start()` reject
    - `setPattern` and `setMood` use `queuePattern` and `queueMood`; ignore non-finite or non-positive bpm
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4, 4.1, 4.2, 11.1, 11.2, 11.3, 11.4, 11.5, 12.2_

  - [ ] 4.3 Implement tick, mood switch release and `onStep`
    - `tick(time)` calls `advance`, updates state, sets `Transport.bpm.value` when `bpm` is returned, triggers events on the effective mood's group with `duration = lengthSteps * stepSeconds * GATE`, applies the `DroneCommand`, then schedules `onStep(step, bar)` through `Tone.getDraw().schedule` with captured values
    - On effective mood change, call `triggerRelease(time)` on the old group's sustained voices and leave its reverb connected
    - `onStep` uses a `Set`, returns an unsubscribe, copies the set before iterating, and catches errors per listener
    - Wrap tick work so a bad pattern never throws inside the Transport callback
    - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 10.5, 12.2, 12.4_

  - [ ]* 4.4 Write integration tests with a stubbed Tone module
    - Create `src/audio/tonePlayer.test.ts` using `vi.mock('tone')` to record call order
    - **Property 7: Draw step fidelity** (captured step and bar reach `onStep`)
    - **Validates: Requirements 10.5**
    - **Property 13: Groups live until teardown, tails are never cut** (no group disposal or rebuild across mood switches, `stop()` and restarts)
    - **Validates: Requirements 3.3, 9.1, 9.2**
    - **Property 14: start() is idempotent for groups** (concurrent and repeated calls build once and return the same promise)
    - **Validates: Requirements 2.3, 2.4, 3.1, 3.2**
    - **Property 15: Tone.start() is first and synchronous** (called before `start()` returns and before any constructor or `ready`; rejection builds nothing)
    - **Validates: Requirements 2.1, 2.5**

- [ ] 5. Wire the player into the audio entry point
  - [ ] 5.1 Update `src/audio/index.ts`
    - Export `createPlayer` as `createTonePlayer` typed `() => Player`
    - Also export `createTonePlayer` and `TonePlayer`
    - Keep exporting `createFakePlayer`, `FAKE_BPM`, `FakePlayer`
    - Confirm `src/audio` does not import from `src/ui` or `src/app`
    - _Requirements: 1.3, 1.4, 1.5_

- [ ] 6. Build the dev listening page
  - [ ] 6.1 Create `dev/listen.html` and `dev/listen.ts`
    - Load the image from the URL `/scenes/empty-lot.png` (Vite serves `public/` at the site root), draw at `ANALYSIS_WIDTH` wide, read pixels, show an error naming the file if loading fails
    - Add band A and B center sliders, a density slider defaulting to `DEFAULT_DENSITY`, and a mood toggle defaulting to `suggestedMood`
    - `rebuild()` runs `analyzeImage`, `scanBand` twice and `generatePattern`, then calls `player.setPattern` synchronously in each input handler
    - Play button stays disabled until image load and the first `rebuild()` finish; its click handler calls `setPattern` then `player.start()` with no `await` before it
    - Display current step and bar from `onStep`, the band scores and the four velocity rows
    - Use `createTonePlayer()` so `dispose()` is available
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 2.1_

  - [ ] 6.2 Include `dev` in `tsconfig.json`
    - Add `dev` to the `include` array so `tsc -b` type-checks `dev/listen.ts`
    - Confirm `vite build` still uses only the root `index.html`
    - _Requirements: 13.6_

- [ ] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests 1 to 6 and 8 to 12 live in `src/audio/schedule.test.ts`; properties 7 and 13 to 15 are covered by the stubbed-Tone tests in task 4.4 and by listening on the dev page
- Sound values in `instruments.ts` are starting points to be tuned by ear
- Existing tests must keep passing, and `createFakePlayer` must remain exported

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["2.4"] },
    { "id": 5, "tasks": ["2.5"] },
    { "id": 6, "tasks": ["2.6"] },
    { "id": 7, "tasks": ["2.7"] },
    { "id": 8, "tasks": ["2.8"] },
    { "id": 9, "tasks": ["2.9"] },
    { "id": 10, "tasks": ["2.10"] },
    { "id": 11, "tasks": ["2.11"] },
    { "id": 12, "tasks": ["2.12"] },
    { "id": 13, "tasks": ["2.13"] },
    { "id": 14, "tasks": ["2.14"] },
    { "id": 15, "tasks": ["3"] },
    { "id": 16, "tasks": ["4.1"] },
    { "id": 17, "tasks": ["4.2"] },
    { "id": 18, "tasks": ["4.3"] },
    { "id": 19, "tasks": ["4.4", "5.1"] },
    { "id": 20, "tasks": ["6.1", "6.2"] },
    { "id": 21, "tasks": ["7"] }
  ]
}
```
