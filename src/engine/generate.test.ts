import { describe, expect, it } from 'vitest';
import { generatePattern } from './generate';
import { MOODS, pitchName } from './presets';
import type { GenerateInput, ImageFeatures, MoodId } from './types';

const features = (signalStrength = 0.8): ImageFeatures => ({
  saturation: 0.5,
  contrast: 0.5,
  detailDensity: 0.5,
  signalStrength,
  suggestedMood: 'hollow',
});

const zeros = (): number[] => new Array<number>(16).fill(0);

const input = (over: {
  mood?: MoodId;
  density?: number;
  signal?: number;
  a?: number[];
  b?: number[];
  register?: number;
}): GenerateInput => ({
  features: features(over.signal),
  bands: {
    A: { scores: over.a ?? zeros(), register: 0.3 },
    B: { scores: over.b ?? zeros(), register: over.register ?? 0.8 },
  },
  mood: over.mood ?? 'neon',
  density: over.density ?? 50,
});

const hitSteps = (steps: { velocity: number }[]): number[] =>
  steps.flatMap((s, i) => (s.velocity > 0 ? [i] : []));

describe('clap placement', () => {
  it('hollow claps only on step 12', () => {
    const p = generatePattern(input({ mood: 'hollow' }));
    expect(hitSteps(p.tracks.clap)).toEqual([12]);
  });

  it('neon claps on steps 4 and 12', () => {
    const p = generatePattern(input({ mood: 'neon' }));
    expect(hitSteps(p.tracks.clap)).toEqual([4, 12]);
  });
});

describe('hollow kick density switch', () => {
  it('uses two kicks at density 89', () => {
    const p = generatePattern(input({ mood: 'hollow', density: 89 }));
    expect(hitSteps(p.tracks.kick)).toEqual([0, 8]);
  });

  it('uses four kicks at density 90', () => {
    const p = generatePattern(input({ mood: 'hollow', density: 90 }));
    expect(hitSteps(p.tracks.kick)).toEqual([0, 6, 8, 14]);
  });
});

describe('track B pitches', () => {
  it.each(['hollow', 'neon'] as MoodId[])('follow bassLine for %s', (mood) => {
    const m = MOODS[mood];
    const p = generatePattern(input({ mood, register: 0.8 }));
    p.tracks.B.forEach((step, i) => {
      expect(step.pitch).toBe(pitchName(2, m.rootPitchClass + m.scaleOffsets[m.bassLine[i]]));
    });
  });

  it.each([
    [0.5, 2],
    [1, 2],
    [0.49, 3],
    [0.25, 3],
    [0.24, 4],
    [0, 4],
  ])('register %f uses octave %i', (register, octave) => {
    const m = MOODS.neon;
    const p = generatePattern(input({ mood: 'neon', register }));
    p.tracks.B.forEach((step, i) => {
      expect(step.pitch).toBe(pitchName(octave, m.rootPitchClass + m.scaleOffsets[m.bassLine[i]]));
    });
  });
});

describe('accent cap and tie-break', () => {
  it('with 16 equal scores keeps the 6 lowest indices as accents', () => {
    const all = new Array<number>(16).fill(1);
    const p = generatePattern(input({ mood: 'neon', density: 50, a: all }));
    const vel = p.tracks.A.map((s) => s.velocity);
    expect(vel.slice(0, 6)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(vel.slice(6)).toEqual(new Array<number>(10).fill(0.45));
  });

  it('overflow candidates are silent when ghosts are disabled (density 24)', () => {
    const all = new Array<number>(16).fill(1);
    const p = generatePattern(input({ mood: 'neon', density: 24, a: all }));
    const vel = p.tracks.A.map((s) => s.velocity);
    expect(vel.slice(0, 6)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(vel.slice(6)).toEqual(new Array<number>(10).fill(0));
  });
});

describe('ghost gating', () => {
  const a = zeros();
  a[3] = 0.6; // between ghost and accent thresholds at densities 24 and 25

  it('has no ghost at density 24', () => {
    const p = generatePattern(input({ density: 24, a }));
    expect(p.tracks.A[3].velocity).toBe(0);
  });

  it('has a ghost at density 25', () => {
    const p = generatePattern(input({ density: 25, a }));
    expect(p.tracks.A[3].velocity).toBe(0.45);
  });
});

describe('low signal', () => {
  const loud = new Array<number>(16).fill(1);

  it('hollow has no drone and silent A and B', () => {
    const p = generatePattern(input({ mood: 'hollow', signal: 0.05, a: loud, b: loud }));
    expect(p.tracks.B[0].velocity).toBe(0);
    expect(p.tracks.B[0].length).toBeUndefined();
    expect(hitSteps(p.tracks.A)).toEqual([]);
    expect(hitSteps(p.tracks.B)).toEqual([]);
  });

  it('keeps kick and clap unchanged', () => {
    const quiet = generatePattern(input({ mood: 'hollow', signal: 0.05, a: loud, b: loud }));
    const live = generatePattern(input({ mood: 'hollow', signal: 0.8, a: loud, b: loud }));
    expect(quiet.tracks.kick).toEqual(live.tracks.kick);
    expect(quiet.tracks.clap).toEqual(live.tracks.clap);
  });

  it('hollow with live signal plays the drone on step 0', () => {
    const p = generatePattern(input({ mood: 'hollow', signal: 0.8 }));
    expect(p.tracks.B[0]).toMatchObject({ velocity: 1, length: 16 });
  });
});
