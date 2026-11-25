import { describe, expect, it } from 'vitest';
import { resolvePattern } from './resolve';
import { STEPS } from './types';
import type { Overrides, Pattern, Step } from './types';

function makePattern(): Pattern {
  const blank = (): Step[] => Array.from({ length: STEPS }, () => ({ velocity: 0 }));
  const b: Step[] = Array.from({ length: STEPS }, (_, i) => ({ velocity: 0, pitch: `D${i % 3}` }));
  b[0] = { velocity: 1, pitch: 'D2', length: 16 };
  b[3] = { velocity: 0.45, pitch: 'F2', length: 1 };
  const a = blank();
  a[5] = { velocity: 1 };
  return { bpm: 90, mood: 'hollow', tracks: { kick: blank(), clap: blank(), A: a, B: b } };
}

describe('resolvePattern', () => {
  it('on sets velocity 1 and keeps pitch', () => {
    const auto = makePattern();
    const out = resolvePattern(auto, { B: { 1: 'on', 3: 'on' } });
    expect(out.tracks.B[1]).toEqual({ velocity: 1, pitch: 'D1' });
    expect(out.tracks.B[3]).toEqual({ velocity: 1, pitch: 'F2', length: 1 });
  });

  it('off sets velocity 0, keeps pitch and removes length', () => {
    const out = resolvePattern(makePattern(), { B: { 0: 'off' }, A: { 5: 'off' } });
    expect(out.tracks.B[0]).toEqual({ velocity: 0, pitch: 'D2' });
    expect('length' in out.tracks.B[0]).toBe(false);
    expect(out.tracks.A[5]).toEqual({ velocity: 0 });
  });

  it('leaves steps without overrides deeply equal to auto', () => {
    const auto = makePattern();
    const out = resolvePattern(auto, { kick: { 0: 'on' } });
    expect(out.tracks.clap).toEqual(auto.tracks.clap);
    expect(out.tracks.B).toEqual(auto.tracks.B);
    expect(out.tracks.kick.slice(1)).toEqual(auto.tracks.kick.slice(1));
    expect(out.bpm).toBe(auto.bpm);
    expect(out.mood).toBe(auto.mood);
  });

  it('ignores invalid tracks, steps and values', () => {
    const auto = makePattern();
    const bad = {
      nope: { 0: 'on' },
      A: { 16: 'on', '-1': 'on', '1.5': 'on', 2: 'maybe', 3: 1, abc: 'on' },
    } as unknown as Overrides;
    expect(resolvePattern(auto, bad)).toEqual(auto);
  });

  it('returns a new pattern without mutating inputs', () => {
    const auto = makePattern();
    const overrides: Overrides = { B: { 0: 'off', 1: 'on' }, A: { 5: 'off' } };
    const autoCopy = structuredClone(auto);
    const overridesCopy = structuredClone(overrides);
    const out = resolvePattern(auto, overrides);
    expect(out).not.toBe(auto);
    expect(out.tracks.B).not.toBe(auto.tracks.B);
    expect(out.tracks.B[0]).not.toBe(auto.tracks.B[0]);
    expect(auto).toEqual(autoCopy);
    expect(overrides).toEqual(overridesCopy);
  });
});
