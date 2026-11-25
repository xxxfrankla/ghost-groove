import { TRACK_IDS } from './presets';
import { STEPS } from './types';
import type { Overrides, Pattern, Step } from './types';

/** Returns a new pattern with valid overrides applied. Inputs are never mutated. */
export function resolvePattern(auto: Pattern, overrides: Overrides): Pattern {
  const tracks = {} as Pattern['tracks'];
  for (const id of TRACK_IDS) {
    tracks[id] = auto.tracks[id].map((s): Step => ({ ...s }));
  }
  const resolved: Pattern = { bpm: auto.bpm, mood: auto.mood, tracks };

  for (const id of TRACK_IDS) {
    const perTrack = overrides?.[id];
    if (perTrack === undefined || perTrack === null || typeof perTrack !== 'object') continue;
    for (const key of Object.keys(perTrack)) {
      const i = Number(key);
      if (!Number.isInteger(i) || String(i) !== key || i < 0 || i >= STEPS) continue;
      const value = (perTrack as Record<string, unknown>)[key];
      const step = tracks[id][i];
      if (!step) continue;
      if (value === 'on') {
        step.velocity = 1;
      } else if (value === 'off') {
        step.velocity = 0;
        delete step.length;
      }
    }
  }
  return resolved;
}
