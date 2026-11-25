# Project Structure

```
src/
  engine/     pure TS, no DOM: types, analyze, scan, generate, resolve, presets
  audio/      Tone.js player, instruments, sample loading
  ui/         photo stage, bands, sequencer, side panel, hint
  app/        state, overrides, wiring engine <-> audio <-> UI
  fixtures/   example features, scans and patterns (JSON)
public/
  scenes/     built-in photos
  samples/    drum samples (CC0 or original)
.kiro/
  specs/  steering/  hooks/
```

## Data flow
```
UI                                   Engine + Audio
load photo, fix EXIF orientation
downscale to ANALYSIS_WIDTH ───────▶ analyzeImage(img)     → ImageFeatures
band drag ─────────────────────────▶ scanBand(img, band)    → BandScan
mood / density controls ───────────▶ generatePattern(input) → Pattern (auto)
overrides state ───────────────────▶ resolvePattern(auto, overrides) → Pattern
                                     player.setPattern(p)   (applies next bar)
playhead + cell highlight ◀───────── player.onStep(step, bar)
```

## Boundaries
- `src/engine` and `src/audio` must not import from `src/ui` or `src/app`.
- `src/engine` must not touch the DOM.
- `src/ui` and `src/app` talk to the engine and audio only through the types and functions in `src/engine/types.ts`.
- The UI keeps both the auto pattern and the resolved pattern. Comparing them is how it draws the four cell states.
- `src/fixtures/` holds JSON used by tests and by stubs. Regenerate it when `types.ts` changes.
