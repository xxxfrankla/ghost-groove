import { describe, expect, it } from 'vitest';
import { blackImage, emptyLot, neonStreet, type Fixture } from '../fixtures';
import { generatePattern } from './generate';

const run = (f: Fixture) =>
  generatePattern({
    features: f.features,
    bands: f.bands,
    mood: f.features.suggestedMood,
    density: 50,
  });

const audible = (steps: { velocity: number }[]) => steps.filter((s) => s.velocity > 0).length;

describe('fixture behaviour at density 50', () => {
  it('emptyLot: band A has exactly one step, velocity 1 at index 11', () => {
    const a = run(emptyLot).tracks.A;
    a.forEach((s, i) => {
      if (i === 11) expect(s.velocity).toBe(1);
      else expect(s.velocity).toBe(0);
    });
  });

  it('blackImage: every A and B step is silent', () => {
    const p = run(blackImage);
    for (const s of [...p.tracks.A, ...p.tracks.B]) expect(s.velocity).toBe(0);
  });

  it('neonStreet has more audible A and B steps than emptyLot', () => {
    const count = (f: Fixture) => {
      const p = run(f);
      return audible(p.tracks.A) + audible(p.tracks.B);
    };
    expect(count(neonStreet)).toBeGreaterThan(count(emptyLot));
  });
});
