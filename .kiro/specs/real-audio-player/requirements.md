# Requirements Document

## Introduction

The Real Audio Player replaces the silent `createFakePlayer` behind `createPlayer` with a Tone.js-based player that implements the existing `Player` contract in `src/engine/types.ts` without changing it. The player runs a 16-step, 16th-note loop driven by `Tone.Transport`, synthesizes all instruments (no sample files), applies pattern and mood changes only at bar boundaries, sustains a Hollow drone voice across bars, and reports step progress through `Tone.Draw`. `createFakePlayer` remains exported for tests.

## Glossary

- **Player**: The contract defined in `src/engine/types.ts` with `start`, `stop`, `setPattern`, `setMood`, `onStep`.
- **TonePlayer**: The concrete player returned by `createTonePlayer()`, a `Player` extended with `dispose()`.
- **Schedule_Module**: The pure module `src/audio/schedule.ts` that decides per-step musical events with no Tone, DOM, or randomness.
- **Tone_Player_Module**: The module `src/audio/tonePlayer.ts` that owns Tone.js objects, the Transport, and Draw scheduling.
- **Instruments_Module**: The data-only module `src/audio/instruments.ts` holding tunable sound settings.
- **Step**: A single 16th-note slot in a 16-step bar, indexed 0 to 15.
- **Bar**: One complete cycle of 16 steps.
- **Mood**: Either `hollow` or `neon`, selecting a voice group and effects chain.
- **Group**: The set of synths, effects, and output gain belonging to one mood (Hollow or Neon) or shared percussion (kick, clap).
- **Drone**: The sustained Hollow track-B voice that holds a pitch across bars via `triggerAttack`/`triggerRelease` instead of retriggering each bar.
- **DroneCommand**: The instruction (`none`, `trigger`, `hold`, `release`) that `Schedule_Module` emits for the drone voice at a given step.
- **NoteEvent**: A planned percussive or melodic trigger for a step, excluding the drone.
- **Pattern**: The existing data structure with `bpm`, `mood`, and per-track `Step` arrays, as defined in `src/engine/types.ts`.

## Requirements

### Requirement 1: Implement the Player contract with Tone.js

**User Story:** As a developer integrating the audio engine, I want the real player to implement the existing `Player` contract, so that I can swap it in without changing any calling code.

#### Acceptance Criteria

1. THE Tone_Player_Module SHALL export a `createTonePlayer()` function that returns an object implementing `start`, `stop`, `setPattern`, `setMood`, and `onStep` as defined by the `Player` type in `src/engine/types.ts`.
2. THE Tone_Player_Module SHALL export the return type of `createTonePlayer()` as `TonePlayer`, defined as `Player` extended with a `dispose()` method not present on `Player`.
3. THE src/audio/index.ts module SHALL export `createPlayer` typed as `() => Player`, implemented as `createTonePlayer`.
4. THE src/audio/index.ts module SHALL continue to export `createFakePlayer`, `FAKE_BPM`, and `FakePlayer`.
5. THE src/engine/types.ts module SHALL remain unchanged by this feature.

### Requirement 2: Synchronous Tone.start() inside the user gesture

**User Story:** As a user clicking Play, I want audio to start reliably on the first click, so that I do not have to click twice or see a browser warning.

#### Acceptance Criteria

1. WHEN `start()` is called, THE Tone_Player_Module SHALL invoke `Tone.start()` synchronously, as the first action, before any `await` and before building any Group.
2. IF `start()` is called while disposed, THEN THE Tone_Player_Module SHALL return a rejected promise without calling `Tone.start()`.
3. IF a `start()` call is already in flight, THEN THE Tone_Player_Module SHALL return the existing in-flight promise without calling `Tone.start()` again.
4. IF the player is already running, THEN THE Tone_Player_Module SHALL return a resolved promise without calling `Tone.start()` again.
5. IF `Tone.start()` rejects or throws, THEN THE Tone_Player_Module SHALL reject the promise returned by `start()` and SHALL NOT build any Group or touch the Transport.

### Requirement 3: Group construction and lifecycle

**User Story:** As a developer, I want voice groups built once and kept alive, so that mood switches and restarts never click, drop sound, or leak resources.

#### Acceptance Criteria

1. WHEN `start()` succeeds for the first time, THE Tone_Player_Module SHALL build the shared percussion Group, the Hollow Group, and the Neon Group exactly once.
2. WHEN `start()` is called after a prior successful `start()`, THE Tone_Player_Module SHALL skip building Groups that already exist.
3. WHILE the player is running or stopped but not disposed, THE Tone_Player_Module SHALL NOT dispose or rebuild the Hollow Group or the Neon Group.
4. THE Tone_Player_Module SHALL dispose the shared Group, the Hollow Group, and the Neon Group only when `dispose()` is called.
5. IF building a Group fails after `Tone.start()` has resolved, THEN THE Tone_Player_Module SHALL reject the `start()` promise and dispose any partially built Groups.

### Requirement 4: Bar-aligned pattern and mood changes

**User Story:** As a user adjusting sliders while listening, I want pattern and mood changes to apply cleanly at the next bar, so that the groove never changes mid-bar.

#### Acceptance Criteria

1. WHEN `setPattern` or `setMood` is called while the player is stopped, THE Schedule_Module SHALL apply the change immediately.
2. WHEN `setPattern` or `setMood` is called while the player is running, THE Schedule_Module SHALL store the change as pending and SHALL apply it only when the current step equals 0.
3. WHEN `setPattern` is called, THE Schedule_Module SHALL also set the pending mood to the pattern's mood.
4. WHILE the player is running, THE Schedule_Module SHALL preserve `state.pattern` and `state.mood` unchanged for every step from 1 to 15.
5. WHEN a pending pattern is promoted at step 0, THE Schedule_Module SHALL return the promoted pattern's `bpm`.

### Requirement 5: Per-step event planning

**User Story:** As a developer, I want a pure function that plans each step's notes, so that the scheduling logic can be tested without audio.

#### Acceptance Criteria

1. WHEN `planStep` is called for a track whose step has `velocity` less than or equal to 0, THE Schedule_Module SHALL omit an event for that track.
2. WHEN `planStep` is called for a track-B step with no `pitch`, THE Schedule_Module SHALL omit an event for that step.
3. THE Schedule_Module SHALL return events from `planStep` in track order kick, clap, A, B.
4. THE Schedule_Module SHALL set each returned event's `gain` to `velocityToGain(velocity)`.
5. THE Schedule_Module SHALL clamp each event's `lengthSteps` to the range 1 to 16, defaulting to 1 when `length` is absent.
6. WHEN `planStep` and `advance` are called with the same inputs, THE Schedule_Module SHALL return equal results and SHALL NOT mutate the input pattern or state.

### Requirement 6: Velocity-to-gain mapping

**User Story:** As a listener, I want ghost notes to sound clearly quieter than accents, so that the groove has dynamic expression.

#### Acceptance Criteria

1. THE Schedule_Module SHALL map `velocityToGain(0)` to 0 and `velocityToGain(1)` to 1.
2. THE Schedule_Module SHALL produce a strictly increasing `velocityToGain` result over the input range 0 to 1.
3. THE Schedule_Module SHALL produce `velocityToGain(0.45)` less than or equal to half of `velocityToGain(1)`.

### Requirement 7: Voice selection by track and mood

**User Story:** As a developer, I want voice selection to depend only on track, mood, and note length, so that it stays predictable and testable.

#### Acceptance Criteria

1. THE Schedule_Module SHALL map the kick track to voice `kick` and the clap track to voice `clap` regardless of mood.
2. THE Schedule_Module SHALL map track A to voice `hollowMetal` when the mood is `hollow` and to voice `neonHat` when the mood is `neon`.
3. WHERE the mood is `hollow`, THE Schedule_Module SHALL map a track-B note with `lengthSteps` greater than or equal to `DRONE_MIN_STEPS` to voice `hollowDrone`, and SHALL map a shorter track-B note to voice `hollowBass`.
4. WHERE the mood is `neon`, THE Schedule_Module SHALL map every track-B note to voice `neonBass`.

### Requirement 8: Drone continuity across bars

**User Story:** As a listener, I want the Hollow drone to sustain smoothly across bar lines, so that long notes do not re-attack and click on every repeat.

#### Acceptance Criteria

1. THE Schedule_Module SHALL exclude `hollowDrone` events from `planStep` results.
2. WHEN `planDrone` identifies a drone note whose pitch matches `state.drone`, THE Schedule_Module SHALL return `DroneCommand` `hold` and SHALL leave `state.drone` unchanged.
3. WHEN `planDrone` identifies a drone note whose pitch differs from `state.drone`, or `state.drone` is null, THE Schedule_Module SHALL return `DroneCommand` `trigger` with that pitch and SHALL set `state.drone` to that pitch.
4. IF the step is 0 and `state.drone` is non-null and the bar has no drone note, THEN THE Schedule_Module SHALL return `DroneCommand` `release` and SHALL set `state.drone` to null.
5. IF the step is 0 and `state.drone` is non-null and the effective mood changes away from `hollow`, THEN THE Schedule_Module SHALL return `DroneCommand` `release` and SHALL set `state.drone` to null.
6. FOR steps 1 through 15, THE Schedule_Module SHALL NOT return `DroneCommand` `release`.
7. WHEN `stopState` is called, THE Schedule_Module SHALL set `state.drone` to null while preserving `pattern`, `mood`, and pending values.
8. THE Schedule_Module SHALL keep `state.drone` non-null only while the effective mood is `hollow`.

### Requirement 9: Mood switching without cutting audio

**User Story:** As a listener, I want switching between Hollow and Neon to sound natural, so that reverb tails and sustained notes are not cut off abruptly.

#### Acceptance Criteria

1. WHEN the effective mood changes at step 0, THE Tone_Player_Module SHALL call `triggerRelease` on the old Group's sustained voices without disposing or disconnecting the old Group.
2. WHEN the effective mood changes, THE Tone_Player_Module SHALL leave the old Group's reverb connected so its tail continues to play.
3. WHEN the effective mood changes, THE Tone_Player_Module SHALL use the new mood's already-built Group without delay or dropped bar.

### Requirement 10: Transport tick behavior

**User Story:** As a developer, I want each Transport tick to trigger the right voices and report the right step, so that the engine stays in sync with the UI.

#### Acceptance Criteria

1. WHEN a Transport tick fires for a step, THE Tone_Player_Module SHALL call `advance` with the current state and step, and SHALL update its stored state with the result.
2. WHEN `advance` returns a `bpm` value, THE Tone_Player_Module SHALL set `Transport.bpm.value` to that value.
3. WHEN a Transport tick fires, THE Tone_Player_Module SHALL trigger every returned `NoteEvent` on the appropriate Group's voice at the tick's scheduled time.
4. WHEN a Transport tick fires, THE Tone_Player_Module SHALL apply the returned `DroneCommand` to the Hollow drone voice at the tick's scheduled time.
5. WHEN a Transport tick fires, THE Tone_Player_Module SHALL schedule the `onStep` callbacks through `Tone.Draw` with the step and bar values captured at scheduling time.

### Requirement 11: Stop and dispose behavior

**User Story:** As a developer, I want stop and dispose to behave predictably, so that restarting or tearing down the player never leaves it in a broken state.

#### Acceptance Criteria

1. WHEN `stop()` is called, THE Tone_Player_Module SHALL stop and cancel the Transport, cancel scheduled Draw callbacks, call `triggerRelease` on sustained voices, and reset the step and bar counters to 0.
2. WHEN `stop()` is called, THE Tone_Player_Module SHALL preserve any pending pattern or mood changes.
3. WHEN `dispose()` is called, THE Tone_Player_Module SHALL call `stop()`, clear all `onStep` listeners, and dispose every synth, filter, reverb, and gain node in every Group.
4. IF `dispose()` is called more than once, THEN THE Tone_Player_Module SHALL treat the second and subsequent calls as a no-op.
5. IF `start()` is called after `dispose()`, THEN THE Tone_Player_Module SHALL reject the returned promise.

### Requirement 12: Resilience to malformed pattern data

**User Story:** As a developer, I want the player to tolerate imperfect pattern data, so that a bad value never stops playback.

#### Acceptance Criteria

1. IF a step's `velocity` is not greater than 0, THEN THE Schedule_Module SHALL treat that step as silent.
2. IF a pattern's `bpm` is non-finite or non-positive, THEN THE Tone_Player_Module SHALL keep the previously active `bpm`.
3. IF a track has fewer than 16 step entries, THEN THE Schedule_Module SHALL produce no event for the missing steps.
4. IF an `onStep` listener throws an error, THEN THE Tone_Player_Module SHALL continue invoking the remaining listeners and SHALL continue running the Transport loop.

### Requirement 13: Dev listening page

**User Story:** As Frank, I want a dev-only page to audition the player against a real image, so that I can tune the sound by ear.

#### Acceptance Criteria

1. THE dev listening page SHALL load the image from the URL `/scenes/empty-lot.png`, draw it to a canvas at `ANALYSIS_WIDTH` pixels wide, and read its pixel data.
2. THE dev listening page SHALL provide sliders for the band A and band B centers, a density slider defaulting to `DEFAULT_DENSITY`, and a mood toggle defaulting to `suggestedMood`.
3. WHEN a slider or the mood toggle changes, THE dev listening page SHALL recompute the pattern and call `player.setPattern` synchronously within the input handler.
4. WHEN the Play button is clicked, THE dev listening page SHALL call `player.start()` directly from the click handler with no `await` preceding it.
5. IF the scene image fails to load, THEN THE dev listening page SHALL display an error message naming the file instead of failing silently.
6. THE dev listening page SHALL be excluded from the production build and SHALL be type-checked by including `dev` in the `tsconfig.json` `include` array.
