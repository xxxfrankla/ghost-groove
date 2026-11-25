# Ghost Groove

**Turn a photo into a loop you can play, reshape, and make your own.**

Ghost Groove is a web instrument that plays photographs. The whole photo sets the mood of the music. Two scan bands on top of the photo decide the beat: each band is cut into 16 cells, and each cell is one step of a 16-step sequencer. A bright streetlight under the band becomes a hit on that step. Drag a band to a different part of the picture and the next bar plays a different groove. Open the sequencer to add or remove any step by hand, and your edits stay put while the photo keeps changing everything else.

Built for **Kiroween 2026**, **Frankenstein** category. The app stitches together three things that don't usually meet: image analysis (Canvas pixel sampling), music synthesis (Web Audio through Tone.js), and a drum-machine interface.

> Status: design is settled, code starts Nov 25. Submission deadline is **Dec 4, 2026, 2:00 PM PT**.

## The 45-second demo

1. Open the empty parking lot and press Play. A sparse kick, a low drone, and one metal hit that rings out every time the playhead crosses the streetlight. The light, the band cell and the sequencer cell all light up together.
2. Drag band A off the light onto the empty sky. At the next bar the metal hit disappears and only the base groove and the drone are left.
3. Switch to the neon street. The drums get dense, the bass starts moving, and short synth notes jump between the signs.
4. Click a step to add a hit, then drag the band again. The hit you added is still there; everything else keeps following the photo.

## How it works

### Two scan bands

| Band | Plays | Reads |
|---|---|---|
| **A** | Percussion layer: metal hits in Hollow, hats in Neon | 16 contrast scores from the strip of the photo under the band |
| **B** | Pitched layer: bass and synth | 16 contrast scores, plus the band's height, which sets the register |

For each cell, the engine scores how much that small area stands out from the rest of the band. Scores are normalized within the band, so a crack of light in a dark room still registers. A score above the accent threshold plays a full-velocity note. A score that only clears the lower threshold plays a **ghost note** (a quiet decorative hit, which is where the name comes from). Pitches are quantized to the current mood's scale, so dragging a band never plays out of key.

Band changes take effect at the start of the next bar, so the beat never stumbles while you drag.

### Mood and density

- **Mood** is a preset: **Hollow** (sparse kick, long tails, metal hits, drone bass) or **Neon** (four-on-the-floor, short bass, hats, short synths). Each mood is a hand-tuned set of samples, envelopes, reverb, patterns and scale. The photo suggests a mood from its saturation, contrast and detail density, and the user can switch it. More moods can be added later as more presets.
- **Density** (Quiet ↔ Crowded) moves the thresholds. Turning it up lets dimmer cells play and enables ghost notes, and at the top end the Hollow kick goes from two hits a bar to four. Switching photos keeps the user's density value.

### The sequencer

Four rows: **Kick**, **Clap**, **A**, **B**. A cell can be in one of four states:

| State | Looks like |
|---|---|
| Base groove | Bone-white fill |
| From the photo | Band color; full height for an accent, half height for a ghost note |
| Added by you | Band color with a white ring |
| Muted by you | Dashed outline; colored if the photo still wants a note there, grey if it doesn't |

Clicking a cell locks it: it stops following the photo. Shift-click hands it back. The first edit shows a one-time hint about Shift-click, any edited row shows a ↺ button that hands the whole row back, and **Clear my edits** resets everything. Edits survive band drags, density changes, mood changes and photo switches.

### Hard photos

- **Dark but with contrast:** only local contrast is used, so a door gap of light still triggers a step.
- **Blurry:** a blob of neon that differs from its surroundings still reads.
- **Almost black or pure noise:** the engine measures signal strength on the raw image first. If it's too weak, the base groove keeps playing and the photo layers fade out. Scanning an empty night sky gives you silence on purpose.

## Architecture

Vite + React + TypeScript + Canvas 2D + Tone.js. Everything runs in the browser; photos never leave the user's machine, and there is no server.

```
UI (Sunny)                          Engine + Audio (Frank)
──────────                          ──────────────────────
load photo, fix EXIF orientation
downscale to ANALYSIS_WIDTH ──────▶ analyzeImage(img)     → ImageFeatures
band drag ────────────────────────▶ scanBand(img, band)    → BandScan
mood / density controls ──────────▶ generatePattern(input) → Pattern (auto)
overrides state ──────────────────▶ resolvePattern(auto, overrides) → Pattern
                                    player.setPattern(p)   (applies next bar)
playhead + cell highlight ◀──────── player.onStep(step, bar)
```

```
src/
  engine/     Frank   pure TS, no DOM: types, analyze, scan, generate, resolve, presets
  audio/      Frank   Tone.js player, instruments, sample loading
  ui/         Sunny   photo stage, bands, sequencer, side panel, hint
  app/        Sunny   state, overrides, wiring engine ↔ audio ↔ UI
  fixtures/   shared  example features, scans and patterns (JSON)
public/
  scenes/             built-in photos
  samples/            drum samples (CC0 or our own)
.kiro/
  specs/  steering/  hooks/
```

### The contract (`src/engine/types.ts`)

This file is the boundary between the two halves. Change it only by agreement.

```ts
export const STEPS = 16;
export const ANALYSIS_WIDTH = 256; // UI downsamples to this width before analysis

export type MoodId = 'hollow' | 'neon';
export type BandId = 'A' | 'B';
export type TrackId = 'kick' | 'clap' | 'A' | 'B';

export interface ImageFeatures {
  saturation: number;      // 0..1
  contrast: number;        // 0..1
  detailDensity: number;   // 0..1
  signalStrength: number;  // 0..1, low means "too dark or noisy to trust"
  suggestedMood: MoodId;
}

export interface BandPosition { center: number; height: number } // fractions of image height

export interface BandScan {
  scores: number[];        // length 16, 0..1, normalized within the band
  register: number;        // band center, 0 (top) .. 1 (bottom)
}

export interface GenerateInput {
  features: ImageFeatures;
  bands: Record<BandId, BandScan>;
  mood: MoodId;
  density: number;         // 0..100
}

export interface Step {
  velocity: number;        // 0 = silent, 1 = accent, ~0.45 = ghost note
  pitch?: string;          // e.g. "D2"; set on EVERY step of track B, even silent ones
  length?: number;         // in steps, for sustained notes
}

export interface Pattern {
  bpm: number;
  mood: MoodId;
  tracks: Record<TrackId, Step[]>; // each length 16
}

export type Override = 'on' | 'off';
export type Overrides = Partial<Record<TrackId, Partial<Record<number, Override>>>>;

// engine
export declare function analyzeImage(img: ImageData): ImageFeatures;
export declare function scanBand(img: ImageData, band: BandPosition): BandScan;
export declare function generatePattern(input: GenerateInput): Pattern;
export declare function resolvePattern(auto: Pattern, overrides: Overrides): Pattern;

// audio
export interface Player {
  start(): Promise<void>;             // call from the Play click (browsers need a user gesture)
  stop(): void;
  setPattern(p: Pattern): void;       // takes effect at the next bar
  setMood(m: MoodId): void;
  onStep(cb: (step: number, bar: number) => void): () => void; // returns unsubscribe
}
export declare function createPlayer(): Player;
```

Rules the contract relies on:

- An `'on'` override plays at velocity 1 and uses the pitch the engine already computed for that step. That's why track B carries a pitch on every step.
- The UI keeps both the auto pattern and the resolved one. Comparing them is how it draws the four cell states.
- The same image, bands, mood and density always produce the same pattern. No randomness.

## Team split

**Frank: engine and audio (everything you hear).**
**Sunny: interface and deployment (everything you see and touch).**

| | Frank | Sunny |
|---|---|---|
| Owns | `src/engine`, `src/audio`, `.kiro/specs` for the engine, property tests | `src/ui`, `src/app`, styling, deploy |
| Day-1 handoff | `types.ts`, fixture JSON, a stub `generatePattern` that returns fixtures, a fake `Player` that ticks with `setInterval` | Project scaffold (Vite + React + TS), lint, Vercel preview deploys |
| Core work | Image features and band scans, thresholds and ghost notes, pitch from register plus scale, mood suggestion, low-signal fallback, override resolution, Tone.js player with next-bar switching, instruments for both moods | Photo stage with two draggable bands and 16 ticks, contrast strips aligned to the grid, sequencer with four cell states, click / Shift-click / ↺ / Clear, one-time hint, scene picker, mood toggle, density slider, photo upload (EXIF, HEIC message), Space to play |
| Done when | The tests in the next section pass, and both moods loop for a minute without clicks or drift | A first-time user can find "the light makes the sound" without being told, and the demo script runs on the deployed URL |

**Together:** shoot the built-in photos, pick the samples, tune the two moods by ear, run the blind test and the first-timer test, record the video, write the Devpost entry.

Working rules: Sunny never waits on real engine output, because fixtures and the fake player stand in until Nov 29. Frank never touches UI code. Anything that needs both goes through `types.ts`.

## Tests

Engine behaviour is pinned down with property-based tests (Vitest + fast-check):

- **Deterministic:** the same input gives the same pattern, every time.
- **Dark-safe:** a black or noise-only image keeps the base groove and stays silent on bands A and B.
- **Monotonic density:** raising density never removes a note the photo was already playing.
- **Capped:** at most 6 accents per band per bar, even on a photo full of lights.
- **In key:** every pitch on track B belongs to the mood's scale.
- **Overrides win:** after `resolvePattern`, every override is honoured and every other step matches the auto pattern.

The listening checks happen by ear: with eyes closed, you can tell the parking lot from the neon street; with eyes open, you can point at the part of the photo that made the sound you just heard.

## How we use Kiro

- **Specs** (`.kiro/specs/`): the engine spec holds the requirements and the six properties above, which become the tests. A UI spec covers band dragging, cell states and the edit rules.
- **Steering** (`.kiro/steering/`): `contract.md` (the types above and their rules), `sound.md` (moods, scales, BPM, sample list), `ui.md` (colors, cell states, layout).
- **Hooks** (`.kiro/hooks/`): run the engine tests whenever a file in `src/engine` is saved, and regenerate the fixture JSON whenever `types.ts` changes.

The `.kiro` directory is committed and must never be added to `.gitignore`.

## Schedule

| Date | Frank | Sunny |
|---|---|---|
| Nov 25 | Contract, fixtures, stubs, Kiro specs and steering | Scaffold, deploy pipeline, static layout |
| Nov 26–28 | Analysis, scanning, generation, property tests | Photo stage, bands, sequencer, edit states |
| Nov 29 | Integration day: real photos drive real patterns | Integration day |
| Nov 30–Dec 1 | Tone.js player, both moods, edge cases | Panel controls, upload, hint, polish |
| Dec 1 | Request Kiro credits if not done yet | |
| Dec 2 | Feature freeze, deploy, blind test plus first-timer test | Same |
| Dec 3 | Video, Devpost text, Kiro write-up | Same |
| Dec 4 | Submit by noon CT, with a buffer before the 2 PM PT close | |

## Not in v1

Adding tracks, a continuous mood knob, editing velocity per step, mobile layout. Stretch goals if there's time: MIDI or WAV export, live webcam input.

## Submission checklist

- [ ] Public repository with an open-source license
- [ ] `.kiro/` committed at the root, not ignored
- [ ] Working deployed URL
- [ ] Demo video under 3 minutes, public on YouTube or Vimeo
- [ ] Devpost entry with category set to Frankenstein, plus the Kiro usage write-up
- [ ] Source and license listed below for every photo and sample

## Credits

| Asset | Source | License |
|---|---|---|
| Scene: empty parking lot | TBD | TBD |
| Scene: neon street | TBD | TBD |
| Drum samples | TBD | TBD |
